(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.formatAsCurrency = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// for usage via require()
module.exports = 'bcherny/formatAsCurrency'

angular
.module('bcherny/formatAsCurrency', [])
.service('formatAsCurrencyUtilities', ['$locale', function ($locale) {

  // (haystack: String, needles: Array<String>) => Number
  // eg. ('foo', 'o') => 2
  this.occurrences = function (haystack, needles) {

    if (!angular.isString(haystack)) {
      throw new TypeError ('formatAsCurrencyUtilities#occurrences expects its 1st argument to be a String, but was given ' + haystack)
    }

    if (!angular.isArray(needles)) {
      throw new TypeError ('formatAsCurrencyUtilities#occurrences expects its 2nd argument to be an Array, but was given ' + needles)
    }

    needles.forEach(function (needle, n) {
      if (!angular.isString(needle)) {
        throw new TypeError ('formatAsCurrencyUtilities#occurrences expects needles to be Strings, but needle #' + n + ' is ' + needle)
      }
    })

    return needles

      // get counts
      .map(function (needle) {
        var _needle = needle
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]')
        return (
          haystack.match(new RegExp('[' + _needle + ']', 'g')) || []
        ).length
      })

      // sum counts
      .reduce(function (prev, cur) {
        return prev + cur
      }, 0)
  }

  // (currencyString: String) => Number
  // eg. "$123.00" => 123.00
  this.toFloat = function (currencyString) {

    if (!angular.isString(currencyString)) {
      throw new TypeError ('formatAsCurrencyUtilities#toFloat expects its 1st argument to be a String, but was given ' + currencyString)
    }
    currencyString = currencyString.split($locale.NUMBER_FORMATS.DECIMAL_SEP).join(".")
	    .split($locale.NUMBER_FORMATS.GROUP_SEP).join("")
	    .split($locale.NUMBER_FORMATS.CURRENCY_SYM).join('')
    return parseFloat(currencyString, 10)
  }

  // (array: Array) => Array
  // eg. [1,2,2] => [1,2]
  this.uniq = function (array) {
    return array.reduce(function (prev, cur) {
      return prev.indexOf(cur) > -1 ? prev : prev.concat(cur)
    }, [])
  }

  // (a: String, b: String) => Array<String>
  // eg. 123.00, "$123.00" => ["$", ","]
  this.uniqueChars = function (a, b) {

    if (!angular.isString(a)) {
      throw new TypeError ('formatAsCurrencyUtilities#uniqueChars expects its 1st argument to be a String, but was given ' + a)
    }

    if (!angular.isString(b)) {
      throw new TypeError ('formatAsCurrencyUtilities#uniqueChars expects its 2nd argument to be a String, but was given ' + b)
    }

    var chars = a.split('')
    return this.uniq(
      b.split('').sort().reduce(function (prev, cur) {
        return chars.indexOf(cur) < 0 ? prev.concat(cur) : prev
      }, [])
    )

  }

}])
.directive('formatAsCurrency', ['$filter', '$locale', 'formatAsCurrencyUtilities', function ($filter, $locale, formatAsCurrencyUtilities) {

  var util = formatAsCurrencyUtilities

  return {
    require: 'ngModel',
    restrict: 'A',
    link: function (scope, element, attrs, ngModel) {

      var filter = $filter('currency')
      var filterAgumsntsInit = scope.$eval(attrs.filterArguments);
      var filterArguments = Array.isArray(filterAgumsntsInit) ? filterAgumsntsInit : [filterAgumsntsInit]
      var decimalPlaces = scope.$eval(attrs.decimalPlaces);

      scope.$watch(function(){
        return scope.$eval(attrs.currencyFilter)
      }, function (f) {
        filter = f ? $filter(f) : $filter('currency')
      })

      scope.$watch(function(){
	    return scope.$eval(attrs.filterArguments)
      }, function (f) {
	    if(f) {
	      filterArguments = Array.isArray(f) ? f : [f]
	    } else {
	      filterArguments = []
	    }
      }, true)

      scope.$watch(function(){
	    return scope.$eval(attrs.decimalPlaces)
      }, function (f) {
	    if(f !== undefined) {
	      decimalPlaces = f
	    } else {
	      decimalPlaces = 2
	    }
      })

      ngModel.$formatters.push(function (value) {
        return filter(value, ...filterArguments)
      })

      ngModel.$parsers.push(function (value) {
		  if(typeof value !== "string") {
			  value = String(value);
		  }
		  
        // ignore non-numeric characters
        if(typeof value === "string") {
          value = value.replace(/[a-zA-Z!\?>:;\|<@#%\^&\*\)\(\+\/\\={}\[\]_]/g, '')
        }

        var number = (Math.floor(util.toFloat(value) * (10**decimalPlaces)) / (10**decimalPlaces)).toFixed(decimalPlaces)

        if (ngModel.$validators.currency(number)) {

          var formatted = filter(number, ...filterArguments)
          var specialCharacters = util.uniqueChars(number, formatted)

          // did we add a comma or currency symbol?
          var specialCharactersCountChange = [value, formatted]
            .map(function (string) {
              return util.occurrences(string.substr(0, element[0].selectionEnd - 1), specialCharacters)
            })
            .reduce(function (prev, cur) {
              return cur - prev
            })

          // compute the new selection range, correcting for
          // formatting introduced by the currency $filter
          var selectonRange = [
            element[0].selectionStart,
            element[0].selectionEnd
          ].map(function (position) {
            return position + specialCharactersCountChange
          })

          // set the formatted value in the view
          ngModel.$setViewValue(formatted)
          ngModel.$render()

          // set the cursor back to its expected position
          // (since $render resets the cursor the the end)
          element[0].setSelectionRange(selectonRange[0], selectonRange[1])
        }

        return number

      })

      ngModel.$validators.currency = function (modelValue) {
        return !isNaN(modelValue)
      }

      // manually trigger the $formatters pipeline
      function triggerRender() {
        ngModel.$setViewValue(ngModel.$formatters.reduce(function (value, fn) {
          return fn(value)
        }, ngModel.$modelValue))
      }

    }
  }

}])

},{}]},{},[1])(1)
});
