;(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define(function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());

/**
@module mobile-angular-ui.core.activeLinks
@description

`mobile-angular-ui.activeLinks` module sets up `.active` class for `a` elements those `href` attribute matches the current angular `$location` url. It takes care of excluding both search part and hash part from comparison.

`.active` classes are added/removed each time one of `$locationChangeSuccess` or `$includeContentLoaded` is fired.

## Usage

Just declare it as a dependency to your app unless you have already included one of its super-modules.

```
angular.module('myApp', ['mobile-angular-ui.core.activeLinks']);
```

**NOTE:** if you are using it without Bootstrap you may need to add some css to your stylesheets to reflect the activation state of links. I.e.

``` css
a.active {
  color: blue;
}
```

*/
(function () {
  'use strict';

  angular.module("mobile-angular-ui.core.activeLinks", [])

  .run([
      '$rootScope', 
      '$window', 
      '$document',
      '$location',
      function($rootScope, $window, $document, $location){

        var setupActiveLinks = function() {
          // Excludes both search part and hash part from 
          // comparison.
          var url = $location.url(),
              firstHash = url.indexOf('#'),
              firstSearchMark = url.indexOf('?'),
              locationHref = $window.location.href,
              plainUrlLength = locationHref.indexOf(url),
              newPath;

          if (firstHash === -1 && firstSearchMark === -1) {
            newPath = locationHref;
          } else if (firstHash !== -1 && firstHash > firstSearchMark) {
            newPath = locationHref.slice(0, plainUrlLength + firstHash);
          } else if (firstSearchMark !== -1 && firstSearchMark > firstHash) {
            newPath = locationHref.slice(0, plainUrlLength + firstSearchMark);
          }
          
          var domLinks = $document[0].links;
          for (var i = 0; i < domLinks.length; i++) {
            var domLink = domLinks[i];
            var link    = angular.element(domLink);
            if (link.attr('href') && link.attr('href') !== '' && domLink.href === newPath) {
              link.addClass('active');
            } else if (link.attr('href') && link.attr('href') !== '' && domLink.href && domLink.href.length) {
              link.removeClass('active');
            }
          }
        };

        $rootScope.$on('$locationChangeSuccess', setupActiveLinks);
        $rootScope.$on('$includeContentLoaded', setupActiveLinks);
      }
  ]);

}());


/**
 * @module mobile-angular-ui.core.capture
 * @description
 *
 * The `capture` module exposes directives to let you extract markup which can be used in other parts of a template using `uiContentFor` and `uiYieldTo` directives.
 *
 * It provides a way to move or clone a block of markup to other parts of the document.
 *
 * This method is particularly useful to setup parts of the layout within an angular view. Since blocks of html are transplanted within their original `$scope` is easy to create layout interactions depending on the context. Some tipical task you can accomplish with these directives are: _setup the navbar title depending on the view_ or _place a submit button for a form inside a navbar_.
 *
 * ## Usage
 *
 * Declare it as a dependency to your app unless you have already included some of its super-modules.
 *
 * ```
 * angular.module('myApp', ['mobile-angular-ui']);
 * ```
 *
 * Or
 *
 * ```
 * angular.module('myApp', ['mobile-angular-ui']);
 * ```
 *
 * Or
 *
 * ```
 * angular.module('myApp', ['mobile-angular-ui.core.capture']);
 * ```
 *
 * Use `ui-yield-to` as a placeholder.
 *
 * ``` html
 * <!-- index.html -->
 *
 * <div class="navbar">
 *   <div ui-yield-to="title" class="navbar-brand">
 *     <span>Default Title</span>
 *   </div>
 * </div>
 *
 * <div class="app-body">
 *   <ng-view class="app-content"></ng-view>
 * </div>
 * ```
 *
 * Use `ui-content-for` inside any view to populate the `ui-yield-to` content.
 *
 * ``` html
 * <!-- myView.html -->
 *
 * <div ui-content-for="title">
 *   <span>My View Title</span>
 * </div>
 * ```
 *
 * Since the original scope is preserved you can use directives inside `ui-content-for` blocks to interact with the current scope. In the following example we will add a navbar button to submit a form inside a nested view.
 *
 *
 * ``` html
 * <!-- index.html -->
 *
 * <div class="navbar">
 *   <div ui-yield-to="navbarAction">
 *   </div>
 * </div>
 *
 * <div class="app-body">
 *   <ng-view class="app-content"></ng-view>
 * </div>
 * ```
 *
 * ``` html
 * <!-- newCustomer.html -->
 *
 * <form ng-controller="newCustomerController">
 *
 *   <div class="inputs">
 *     <input type="text" ng-model="customer.name" />
 *   </div>
 *
 *   <div ui-content-for="navbarAction">
 *     <button ng-click="createCustomer()">
 *       Save
 *     </button>
 *   </div>
 *
 * </form>
 * ```
 *
 * ``` javascript
 * app.controller('newCustomerController', function($scope, Store){
 *   $scope.customer = {};
 *   $scope.createCustomer = function(){
 *     Store.create($scope.customer);
 *     // ...
 *   }
 * });
 * ```
 *
 * If you wish you can also duplicate markup instead of move it. Just add `duplicate` parameter to `uiContentFor` directive to specify this behaviour.
 *
 * ``` html
 * <div ui-content-for="navbarAction" duplicate>
 *   <button ng-click="createCustomer()">
 *     Save
 *   </button>
 * </div>
 * ```
 */
(function () {
   'use strict';

   angular.module('mobile-angular-ui.core.capture', [])

   .run([
     'Capture',
     '$rootScope',
     function(Capture, $rootScope) {
       $rootScope.$on('$routeChangeSuccess', function() {
         Capture.resetAll();
       });
     }
   ])

   .factory('Capture', [
     '$compile',
     function($compile) {
       var yielders = {};

       return {
         resetAll: function() {
           for (var name in yielders) {
            if (yielders.hasOwnProperty(name)) {
              this.resetYielder(name);
            }
           }
         },

         resetYielder: function(name) {
           var b = yielders[name];
           this.setContentFor(name, b.defaultContent, b.defaultScope);
         },

         putYielder: function(name, element, defaultScope, defaultContent) {
           var yielder = {};
           yielder.name = name;
           yielder.element = element;
           yielder.defaultContent = defaultContent || '';
           yielder.defaultScope = defaultScope;
           yielders[name] = yielder;
         },

         getYielder: function(name) {
           return yielders[name];
         },

         removeYielder: function(name) {
           delete yielders[name];
         },

         setContentFor: function(name, content, scope) {
           var b = yielders[name];
           if (!b) {
             return;
           }
           b.element.html(content);
           $compile(b.element.contents())(scope);
         }

       };
     }
   ])

  /**
   * @directive uiContentFor
   * @restrict A
   * @description
   *
   * `ui-content-for` makes inner contents to replace the corresponding
   * `ui-yield-to` placeholder contents.
   *
   * `uiContentFor` is intended to be used inside a view in order to populate outer placeholders.
   * Any content you send to placeholders via `ui-content-for` is
   * reverted to placeholder defaults after view changes (ie. on `$routeChangeStart`).
   *
   * @param {string} uiContentFor The id of the placeholder to be replaced
   * @param {boolean} uiDuplicate If present duplicates the content instead of moving it (default to `false`)
   *
   */
   .directive('uiContentFor', [
     'Capture',
     function(Capture) {
       return {
         compile: function(tElem, tAttrs) {
           var rawContent = tElem.html();
           if(tAttrs.uiDuplicate === null || tAttrs.uiDuplicate === undefined) {
             // no need to compile anything!
             tElem.html('');
             tElem.remove();
           }
           return function(scope, elem, attrs) {
             Capture.setContentFor(attrs.uiContentFor, rawContent, scope);
           };
         }
       };
     }
   ])

   /**
    * @directive uiYieldTo
    * @restrict A
    * @description
    *
    * `ui-yield-to` defines a placeholder which contents will be further replaced by `ui-content-for` directive.
    *
    * Inner html is considered to be a default. Default is restored any time `$routeChangeStart` happens.
    *
    * @param {string} uiYieldTo The unique id of this placeholder.
    *
    */
   .directive('uiYieldTo', [
     '$compile', 'Capture', function($compile, Capture) {
       return {
         link: function(scope, element, attr) {
           Capture.putYielder(attr.uiYieldTo, element, scope, element.html());

           element.on('$destroy', function(){
             Capture.removeYielder(attr.uiYieldTo);
           });

           scope.$on('$destroy', function(){
             Capture.removeYielder(attr.uiYieldTo);
           });
         }
       };
     }
   ]);

}());

(function () {
  'use strict';
  var module = angular.module('mobile-angular-ui.core.fastclick', []);

  module.run(['$window', function($window) {

	//Temporarly bugfix in overthrow/fastclick:
	var orgHandler = FastClick.prototype.onTouchEnd;

	// Some old versions of Android don't have Function.prototype.bind
	function bind(method, context) {
		return function() { return method.apply(context, arguments); };
	}

	FastClick.prototype.onTouchEnd = function(event) {

		if (!event.changedTouches) {
      event.changedTouches = [{}];
    }
    
		orgHandler = bind(orgHandler, this);
		orgHandler(event);
	};

	FastClick.attach($window.document.body);

  }]);

  angular.forEach(['select', 'input', 'textarea'], function(directiveName){

    module.directive(directiveName, function(){
      return {
        restrict: 'E',
        compile: function(elem) {
          elem.addClass('needsclick');
        }
      };
    });
  });
}());

/**

@module mobile-angular-ui.core.outerClick
@description

Provides a directive to specifiy a behaviour when click/tap events 
happen outside an element. This can be easily used 
to implement eg. __close on outer click__ feature for a dropdown.

## Usage

Declare it as a dependency to your app unless you have already 
included some of its super-modules.

```
angular.module('myApp', ['mobile-angular-ui']);
```

Or

```
angular.module('myApp', ['mobile-angular-ui.core']);
```

Or

```
angular.module('myApp', ['mobile-angular-ui.core.outerClick']);
```

Use `ui-outer-click` to define an expression to evaluate when an _Outer Click_ event happens.
Use `ui-outer-click-if` parameter to define a condition to enable/disable the listener.

``` html
<div class="btn-group">
  <a ui-turn-on='myDropdown' class='btn'>
    <i class="fa fa-ellipsis-v"></i>
  </a>
  <ul 
    class="dropdown-menu"
    ui-outer-click="Ui.turnOff('myDropdown')"
    ui-outer-click-if="Ui.active('myDropdown')"
    role="menu"
    ui-show="myDropdown" 
    ui-state="myDropdown"
    ui-turn-off="myDropdown">

    <li><a>Action</a></li>
    <li><a>Another action</a></li>
    <li><a>Something else here</a></li>
    <li class="divider"></li>
    <li><a>Separated link</a></li>
  </ul>
</div>
```

*/
(function () {
   'use strict';

   var isAncestorOrSelf = function(element, target) {
     var parent = element;
     while (parent.length > 0) {
       if (parent[0] === target[0]) {
         parent = null;
         return true;
       }
       parent = parent.parent();
     }
     parent = null;
     return false;
   };

   angular.module('mobile-angular-ui.core.outerClick', [])

   /**
    * @service bindOuterClick
    * @as function
    * 
    * @description
    * This is a service function that binds a callback to be conditionally executed
    * when a click event happens outside a specified element.
    *
    * Ie.
    * 
    * ``` js
    * app.directive('myDirective', function('bindOuterClick'){
    *   return {
    *     link: function(scope, element) {
    *       bindOuterClick(element, function(scope, extra){
    *         alert('You clicked ouside me!');
    *       }, function(e){
    *         return element.hasClass('disabled') ? true : false;
    *       });
    *     }
    *   };
    * });
    * ```
    * @scope {scope} the scope to eval callbacks
    * @param {DomElement|$element} element The element to bind to. 
    * @param {function} callback A `function(scope, options)`, usually the result of `$parse`, that is called when an _outer click_ event happens.
    * @param {string|function} condition Angular `$watch` expression to decide whether to run `callback` or not.
    */
   .factory('bindOuterClick', [
     '$document',
     '$timeout',
     function ($document, $timeout) {
       
       return function (scope, element, outerClickFn, outerClickIf) {
         var handleOuterClick = function(event){
           if (!isAncestorOrSelf(angular.element(event.target), element)) {
             scope.$apply(function() {
               outerClickFn(scope, {$event:event});
             });
           }
         };

         var stopWatching = angular.noop;
         var t = null;

         if (outerClickIf) {
           stopWatching = scope.$watch(outerClickIf, function(value){
             $timeout.cancel(t);

             if (value) {
               // prevents race conditions 
               // activating with other click events
               t = $timeout(function() {
                 $document.on('click tap', handleOuterClick);
               }, 0);

             } else {
               $document.unbind('click tap', handleOuterClick);    
             }
           });
         } else {
           $timeout.cancel(t);
           $document.on('click tap', handleOuterClick);
         }

         scope.$on('$destroy', function(){
           stopWatching();
           $document.unbind('click tap', handleOuterClick);
         });
       };
     }
   ])


  /**
   * @directive outerClick
   * 
   * @description
   * Evaluates an expression when an _Outer Click_ event happens.
   * 
   * @param {expression} uiOuterClick Expression to evaluate when an _Outer Click_ event happens.
   * @param {expression} uiOuterClickIf Condition to enable/disable the listener. Defaults to `true`.
   */
   .directive('uiOuterClick', [
     'bindOuterClick', 
     '$parse',
     function(bindOuterClick, $parse){
       return {
         restrict: 'A',
         compile: function(elem, attrs) {
           var outerClickFn = $parse(attrs.uiOuterClick);
           var outerClickIf = attrs.uiOuterClickIf;
           return function(scope, elem) {
             bindOuterClick(scope, elem, outerClickFn, outerClickIf);
           };
         }
       };
     }
   ]);
}());
(function() {
  'use strict';  
  /**
   * @module mobile-angular-ui.core.sharedState
   *
   * @description
   * `mobile-angular-ui.core.sharedState` is expose the homonymous service
   * `SharedState` and a group of directives to access it.
   *
   * `SharedState` allows to use elementary angular or angularish directives
   * to create interactive components.
   *
   * Ie.
   *
   * ``` html
   * <div class="nav nav-tabs" ui-state='activeTab'>
   *   <a ui-set="{activeTab: 1}">Tab1</a>
   *   <a ui-set="{activeTab: 2}">Tab2</a>
   *   <a ui-set="{activeTab: 3}">Tab3</a>
   * </div>
   * <div class="tabs">
   *   <div ui-if="activeTab == 1">Tab1</div>
   *   <div ui-if="activeTab == 2">Tab2</div>
   *   <div ui-if="activeTab == 3">Tab3</div>
   * </div>
   * ```
   * 
   * Using `SharedState` you will be able to:
   * 
   * - Create interactive components without having to write javascript code
   * - Have your controller free from UI logic
   * - Separe `ng-click` triggering application logic from those having a visual effect only
   * - Export state of components to urls
   * - Easily make components comunicate each other
   *
   * Also note that:
   *
   * Data structures retaining statuses will stay outside angular scopes
   * thus they are not evaluated against digest cycle until its necessary. 
   * Also although statuses are sort of global variables `SharedState` will 
   * take care of disposing them when no scopes are requiring them anymore.
   * 
   * A set of `ui-*` directives are available to interact with `SharedState`
   * module and will hopefully let you spare your controllers and your time 
   * for something that is more meaningful than this:
   * 
   * ``` js
   * $scope.activeTab = 1;
   * 
   * $scope.setActiveTab = function(n) {
   *   $scope.activeTab = n;
   * };
   * ```
   * 
   * ## Usage
   * 
   * Declare it as a dependency to your app unless you have already included some 
   * of its super-modules.
   * 
   * ```
   * angular.module('myApp', ['mobile-angular-ui.core.sharedState']);
   * ```
   * 
   * Use `ui-state` directive to require/initialize a state from the target element scope
   * 
   * **Example.** Tabs
   * 
   * <iframe class='embedded-example' src='/examples/tabs.html'></iframe>
   *
   * **Example.** Custom components
   *
   * <iframe class='embedded-example'  src='/examples/lightbulb.html'></iframe>
   *
   * NOTE: `ui-toggle/set/turnOn/turnOff` responds to `click/tap` without stopping propagation so you can use them along with ng-click too. You can also change events to respond to with `ui-triggers` attribute.
   * 
   * Any `SharedState` method is exposed through `Ui` object in `$rootScope`. So you could always do `ng-click="Ui.turnOn('myVar')"`.
   * 
   * Since `SharedState` is a service you can initialize/set statuses through controllers too:
   * 
   * ``` js
   * app.controller('myController', function($scope, SharedState){
   *   SharedState.initialize($scope, "activeTab", 3);
   * });
   * ```
   * 
   * As well as you can use `ui-default` for that: 
   * 
   * ``` html
   * <div class="tabs" ui-state="activeTab" ui-default="thisIsAnExpression(5 + 1 - 2)"></div>
   * ```
   * 
   */
  var module = angular.module('mobile-angular-ui.core.sharedState', []);

  /**
   * @ngdoc service
   * @class SharedState
   *
   * @description
   * 
   * A `SharedState` state can be considered as a global variable identified by an `id`.
   * 
   * `SharedState` service exposes methods to interact with statuses to create, read and update states. 
   * 
   * It acts as a BUS between UI elements to share UI related state that is automatically disposed when all scopes requiring it are destroyed.
   * 
   * eg.
   * 
   * ``` js
   * app.controller('controller1', function($scope, SharedState){
   *   SharedState.initialize($scope, 'myId');
   * });
   * 
   * app.controller('controller2', function(SharedState){
   *   SharedState.toggle('myId');
   * });
   * ```
   * 
   * Data structures retaining statuses will stay outside angular scopes thus they are not evaluated against digest cycle until its necessary. Also although statuses are sort of global variables `SharedState` will take care of disposing them when no scopes are requiring them anymore.
   * 
   * A set of `ui-*` directives are available to interact with `SharedState` module and will hopefully let you spare your controllers and your time for something that is more meaningful than this:
   * 
   * ``` js
   * $scope.activeTab = 1;
   * 
   * $scope.setActiveTab = function(n) {
   *   $scope.activeTab = n;
   * };
   * ```
   *
   */
  
   /**
    * @event 'mobile-angular-ui.state.initialized.ID'
    * @shortname initialized
    * @memberOf mobile-angular-ui.core.sharedState~SharedState 
    * 
    * @description
    * Broadcasted on `$rootScope` when `#initialize` is called for a new state not referenced by any scope currently.
    * 
    * @param {any} currentValue The value with which this state has been initialized
    * 
    * @memberOf mobile-angular-ui.core.sharedState~SharedState
    */
   
   /**
    * @event 'mobile-angular-ui.state.destroyed.ID'
    * @shortname destroyed
    * @memberOf mobile-angular-ui.core.sharedState~SharedState
    * 
    * @description
    * Broadcasted on `$rootScope` when a state is destroyed.         
    * 
    */
   
    /**
     * @event 'mobile-angular-ui.state.changed.ID'
     * @shortname changed
     * @memberOf mobile-angular-ui.core.sharedState~SharedState
     * 
     * @description
     * Broadcasted on `$rootScope` the value of a state changes.
     * 
     * ``` js
     * $scope.$on('mobile-angular-ui.state.changed.uiSidebarLeft', function(e, newVal, oldVal) {
     *   if (newVal === true) {
     *     console.log('sidebar opened');
     *   } else {
     *     console.log('sidebar closed');
     *   }
     * });
     * ```
     * 
     * @param {any} newValue
     * @param {any} oldValue
     * 
     */  

  module.factory('SharedState', [
    '$rootScope',
    function($rootScope){
      var values = {};    // values, context object for evals
      var statusesMeta = {};  // status info
      var scopes = {};    // scopes references
      var exclusionGroups = {}; // support exclusive boolean sets

      return {
        /**
         * @function initialize
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         *
         * Initialize, or require if already intialized, a state identified by `id` within the provided `scope`, making it available to the rest of application.
         * 
         * A `SharedState` is bound to one or more scopes. Each time `initialize` is called for an angular `scope` this will be bound to the `SharedState` and a reference count is incremented to allow garbage collection.
         * 
         * Reference count is decremented once the scope is destroyed. When the counter reach 0 the state will be disposed.
         * 
         * @param  {scope} scope The scope to bound this state
         * @param  {string} id The unique name of this state 
         * @param  {object} [options] Options
         * @param  {object} [options.defaultValue] the initialization value, it is taken into account only if the state `id` is not already initialized
         * @param  {object} [options.exclusionGroup] Specifies an exclusion group for the state. This means that for boolean operations (ie. toggle, turnOn, turnOf) when this state is set to `true`, any other state that is in the same `exclusionGroup` will be set to `false`.
         */
        initialize: function(scope, id, options) {
          options = options || {};
          
          var isNewScope = scopes[scope] === undefined,
              defaultValue = options.defaultValue,
              exclusionGroup = options.exclusionGroup;

          scopes[scope.$id] = scopes[scope.$id] || [];
          scopes[scope.$id].push(id);

          if (!statusesMeta[id]) { // is a brand new state 
                                   // not referenced by any 
                                   // scope currently

            statusesMeta[id] = angular.extend({}, options, {references: 1});

            $rootScope.$broadcast('mobile-angular-ui.state.initialized.' + id, defaultValue);

            if (defaultValue !== undefined) {
              this.setOne(id, defaultValue);
            }

            if (exclusionGroup) {
              // Exclusion groups are sets of statuses references
              exclusionGroups[exclusionGroup] = exclusionGroups[exclusionGroup] || {};
              exclusionGroups[exclusionGroup][id] = true;
            }

          } else if (isNewScope) { // is a new reference from 
                                   // a different scope
            statusesMeta[id].references++; 
          }
          scope.$on('$destroy', function(){
            var ids = scopes[scope.$id] || [];
            for (var i = 0; i < ids.length; i++) {
              var status = statusesMeta[ids[i]];
              
              if (status.exclusionGroup) {
                delete exclusionGroups[status.exclusionGroup][ids[i]];
                if (Object.keys(exclusionGroups[status.exclusionGroup]).length === 0) {
                  delete exclusionGroups[status.exclusionGroup];
                }
              }

              status.references--;
              if (status.references <= 0) {
                delete statusesMeta[ids[i]];
                delete values[ids[i]];
                $rootScope.$broadcast('mobile-angular-ui.state.destroyed.' + id);
              }
            }
            delete scopes[scope.$id];
          });
        },

        /**
         * @function setOne
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         *
         * Set the value of the state identified by `id` to the `value` parameter.
         *
         * @param  {string} id Unique identifier for state
         * @param  {any} value New value for this state
         */
        setOne: function(id, value) {
          if (statusesMeta[id] !== undefined) {
            var prev = values[id];
            values[id] = value;
            if (prev !== value) {
              $rootScope.$broadcast('mobile-angular-ui.state.changed.' + id, value, prev);
            }
            return value;
          } else {
            /* global console: false */
            if (console) {
              console.warn('Warning: Attempt to set uninitialized shared state:', id);
            }
          }
        },

        /**
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * 
         * @function setMany
         * @description
         *
         * Set multiple statuses at once. ie.
         * 
         * ```
         * SharedState.setMany({ activeTab: 'firstTab', sidebarIn: false });
         * ```
         * 
         * @param {object} object An object of the form `{state1: value1, ..., stateN: valueN}`
         */
        setMany: function(map) {
          angular.forEach(map, function(value, id) {
            this.setOne(id, value);
          }, this);
        },


        /**
         * @function set
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         * 
         * A shorthand for both `setOne` and `setMany`.
         * When called with only one parameter that is an object 
         * it is the same of `setMany`, otherwise is the 
         * same of `setOne`.
         * 
         * @param {string|object} idOrMap A state id or a `{state: value}` map object.
         * @param {any} [value] The value to assign in case idOrMap is a string.
         */
        set: function(idOrMap, value) {
          if (angular.isObject(idOrMap) && angular.isUndefined(value)) {
            this.setMany(idOrMap);
          } else {
            this.setOne(idOrMap, value);
          }
        },

        /**
         * @function turnOn
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         * 
         * Set shared state identified by `id` to `true`. If the 
         * shared state has been initialized with `exclusionGroup` 
         * option it will also turn off (set to `false`) all other 
         * statuses from the same exclusion group.
         * 
         * @param  {string} id The unique name of this state
         */
        turnOn: function(id) {
          // Turns off other statuses belonging to the same exclusion group.
          var eg = statusesMeta[id] && statusesMeta[id].exclusionGroup;
          if (eg) {
            var egStatuses = Object.keys(exclusionGroups[eg]);
            for (var i = 0; i < egStatuses.length; i++) {
              var item = egStatuses[i];
              if (item !== id) {
                this.turnOff(item);
              }
            }
          }
          return this.setOne(id, true);
        },

        /**
         * @function turnOff
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * 
         * @description
         * Set shared state identified by `id` to `false`.
         *
         * @param  {string} id The unique name of this state
         */
        turnOff: function(id) {
          return this.setOne(id, false);
        },

        /**
         * @function toggle
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         *
         * If current value for shared state identified by `id` evaluates 
         * to `true` it calls `turnOff` on it otherwise calls `turnOn`. 
         * Be aware that it will take into account `exclusionGroup` option. 
         * See `#turnOn` and `#initialize` for more.
         *
         * @param  {string} id The unique name of this state
         */
        toggle: function(id) {
          return this.get(id) ? this.turnOff(id) : this.turnOn(id);
        },

        /**
         * @function get
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * 
         * @description
         * Returns the current value of the state identified by `id`.
         *
         * @param  {string} id The unique name of this state
         * @returns {any}
         */
        get: function(id) {
          return statusesMeta[id] && values[id];
        },

        /**
         * @function isActive
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         *
         * Return `true` if the boolean conversion of `#get(id)` evaluates to `true`.
         *
         * @param  {string} id The unique name of this state
         * @returns {bool}
         */
        isActive: function(id) {
          return !! this.get(id);
        },

        /**
         * @function active
         * @alias mobile-angular-ui.core.sharedState~SharedState.isActive
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         * 
         * Alias for `#isActive`.
         * 
         * @param  {string} id The unique name of this state
         * @returns {bool}
         */
        active: function(id) {
          return this.isActive(id);
        },

        /**
         * @function isUndefined
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @description
         * 
         * Return `true` if state identified by `id` is not defined.
         * 
         * @param  {string} id The unique name of this state
         * @returns {bool}
         */
        isUndefined: function(id) {
          return statusesMeta[id] === undefined || this.get(id) === undefined;
        },

        /**
         * Returns `true` if state identified by `id` exsists.
         * 
         * @param  {string} id The unique name of this state
         * @returns {bool}
         * 
         * @function has
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         */
        has: function(id) {
          return statusesMeta[id] !== undefined;
        },

        /**
         * Returns the number of references of a status.
         * 
         * @param  {string} id The unique name of this state
         * @returns {integer}
         * 
         * @function referenceCount
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         */
        referenceCount: function(id) {
          var status = statusesMeta[id];
          return status === undefined ? 0 : status.references;
        },

        /**
         * Returns `true` if `#get(id)` is exactly equal (`===`) to `value` param.
         *
         * @param  {string} id The unique name of this state
         * @param  {any} value The value for comparison
         * @returns {bool} 
         * 
         * @function equals
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         */
        equals: function(id, value) {
          return this.get(id) === value;
        },


        /**
         * Alias for `#equals`
         * 
         * @param  {string} id The unique name of this state
         * @param  {any} value The value for comparison
         * @returns {bool} 
         * 
         * @function eq
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         * @alias mobile-angular-ui.core.sharedState~SharedState.equals
         */
        eq: function(id, value) {
          return this.equals(id, value);
        },

        /**
         * Returns an object with all the status values currently stored. 
         * It has the form of `{statusId: statusValue}`.
         * 
         * Bear in mind that in order to spare resources it currently 
         * returns just the internal object retaining statuses values. 
         * Thus it is not intended to be modified and direct changes to it will be not tracked or notified.
         * 
         * Just clone before apply any change to it.
         * 
         * @returns {object}
         * 
         * @function values
         * @memberOf mobile-angular-ui.core.sharedState~SharedState
         */
        values: function() {
          return values;
        }
  
      };
    }
  ]);

  var uiBindEvent = function(scope, element, eventNames, fn){
    eventNames = eventNames || 'click tap';
    element.on(eventNames, function(event){
      scope.$apply(function() {
        fn(scope, {$event:event});
      });
    });
  };

  /**
   * Calls `SharedState#initialize` on the scope relative to the element using it.
   * 
   * @param {string} uiState The shared state id
   * @param {expression} [uiDefault] the default value
   * 
   * @directive uiState
   */
  module.directive('uiState', [
    'SharedState',
    function(SharedState){
      return {
        restrict: 'EA',
        priority: 601, // more than ng-if
        link: function(scope, elem, attrs){
          var id               = attrs.uiState || attrs.id,
              defaultValueExpr = attrs.uiDefault || attrs['default'],
              defaultValue     = defaultValueExpr ? scope.$eval(defaultValueExpr) : undefined;

          SharedState.initialize(scope, id, {
            defaultValue: defaultValue,
            exclusionGroup: attrs.uiExclusionGroup
          });
        }
      };
    }
  ]);

  angular.forEach(['toggle', 'turnOn', 'turnOff', 'set'], 
    function(methodName){
      var directiveName = 'ui' + methodName[0].toUpperCase() + methodName.slice(1);

      /**
       * Calls `SharedState#toggle` when triggering events happens on the element using it.
       * 
       * @param {string} uiToggle the target shared state
       * @param {expression} uiDefault the default value
       *
       * @directive uiToggle
       */
      
      /**
       * @function uiTurnOn
       * 
       * @description
       * Calls `SharedState#turnOn` when triggering events happens on the element using it.
       *
       * 
       * @ngdoc directive
       * 
       * @param {string} uiTurnOn the target shared state
       * @param {expression} uiDefault the default value
       */

      /**
       * @function uiTurnOff
       * 
       * @description
       * Calls `SharedState#turnOff` when triggering events happens on the element using it.
       * 
       * @ngdoc directive
       * 
       * @param {string} uiTurnOff the target shared state
       * @param {string} [uiTriggers='click tap'] the event triggering the call.
       */

      /**
       * @function uiSet
       * 
       * @description
       * Calls `SharedState#set` when triggering events happens on the element using it.
       * 
       * @ngdoc directive
       * 
       * @param {object} uiSet The object to pass to SharedState#set
       * @param {string} [uiTriggers='click tap'] the event triggering the call.
       */
      
      module.directive(directiveName, [
        '$parse',
        '$interpolate',
        'SharedState',
        function($parse, $interpolate, SharedState) {
              var method = SharedState[methodName];
              return {
                restrict: 'A',
                priority: 1, // This would make postLink calls happen after ngClick 
                             // (and similar) ones, thus intercepting events after them.
                             // 
                             // This will prevent eventual ng-if to detach elements 
                             // before ng-click fires.

                compile: function(elem, attrs) {
                  var attr = attrs[directiveName];
                  var needsInterpolation = attr.match(/\{\{/);
                  
                  var exprFn = function($scope) {
                    var res = attr;
                    if (needsInterpolation) {
                      var interpolateFn = $interpolate(res);
                      res = interpolateFn($scope);
                    }
                    if (methodName === 'set') {
                      res = ($parse(res))($scope);    
                    }
                    return res;                                          
                  };

                  return function(scope, elem, attrs) {
                    var callback = function() {
                      var arg = exprFn(scope);
                      return method.call(SharedState, arg);
                    };
                    uiBindEvent(scope, elem, attrs.uiTriggers, callback);
                  };
                }
              };
            }
      ]);
    });

 /**
  * @name uiScopeContext
  * @inner 
  * @description
  * 
  * `uiScopeContext` is not a directive, but a parameter common to any of the 
  * `ui-*` directives in this module.
  *
  * By default all `ui-*` conditions in this module evaluates in the context of 
  * `SharedState` only, thus scope variable are not accessible. To use them you have 
  * two options:
  *
  * #### 1. pre-interpolation
  * 
  * You can use pre-interpolation in expression attribute. For instance the following syntax
  * is ligit:
  * 
  * ``` html
  * <div ui-if='state{{idx}}'><!-- ... --></div>
  * ```
  *
  * In this case `idx` value is taken from scope and embedded into
  * conditions before parse them.
  *
  * This works as expected and is fine for the most cases, but it has a little caveat:
  *
  * The condition has to be re-parsed at each digest loop and has to walk scopes 
  * in watchers.
  *
  * #### 2. uiScopeContext
  *
  * If you are concerned about performance issues using the first approach 
  * `uiScopeContext` is a more verbose but also lightweight alternative 
  * to accomplish the same.
  *  
  * It allows to use current scope vars inside `ui-*` conditions, leaving
  * other scope vars (or the entire scope if not present) apart from the
  * condition evaluation process.
  * 
  * Hopefully this will keep evaluation running against a flat and small data 
  * structure instead of taking into account the whole scope. 
  * 
  * It is a list `scopeVar[ as aliasName] [, ...]` specifing one of more scope
  * variables to take into account when evaluating conditions. ie:
  * 
  * ``` html
  * <!-- use item from ng-repeat -->
  * <div ui-if="openPanel == i" ui-scope-context='i' ng-repeat="i in [1,2,3]">
  *   <div class="panel-body">
  *     <!-- ... -->
  *   </div>
  * </div>
  * ```
  * 
  * ``` html
  * <div ui-if="sharedState1 == myVar1 && sharedState2 == myVar2"
  *   ui-scope-context="myVar1, myVar2"
  * >
  * </div>
  * ```
  * 
  * Be aware that scope vars will take precedence over sharedStates so,
  * in order to avoid name clashes you can use 'as' to refer to scope vars
  * with a different name in conditions:
  * 
  * ``` html
  * <div ui-if="x == myVar1 && y == myVar2"
  *   ui-scope-context="x as myVar1, y as myVar2"
  * >
  * </div>
  * ```
  */
  var parseScopeContext = function(attr) {
    if (!attr || attr === '') {
      return [];
    }
    var vars = attr ? attr.trim().split(/ *, */) : [];
    var res = [];
    for (var i = 0; i < vars.length; i++) {
      var item = vars[i].split(/ *as */);
      if (item.length > 2 || item.length < 1) {
        throw new Error('Error parsing uiScopeContext="' + attr + '"');
      }
      res.push(item);
    }
    return res;
  };

  var mixScopeContext = function(context, scopeVars, scope) {
    for (var i = 0; i < scopeVars.length; i++) {
      var key = scopeVars[i][0];
      var alias = scopeVars[i][1] || key;
      context[alias] = key.split('.').reduce(function (scope, nextKey) {
        return scope[nextKey];
      }, scope);
    }
  };

  var parseUiCondition = function(name, attrs, $scope, SharedState, $parse, $interpolate) {
    var expr = attrs[name];
    var needsInterpolation = expr.match(/\{\{/);
    var exprFn;

    if (needsInterpolation) {
      exprFn = function(context) {
        var interpolateFn = $interpolate(expr);
        var parseFn = $parse(interpolateFn($scope));
        return parseFn(context);
      };
    } else {
      exprFn = $parse(expr);
    }

    var uiScopeContext = parseScopeContext(attrs.uiScopeContext);
    return function() {
      var context;
      if (uiScopeContext.length) {
        context = angular.extend({}, SharedState.values());
        mixScopeContext(context, uiScopeContext, $scope);  
      } else {
        context = SharedState.values();
      }
      return exprFn(context);
    };
  };

  
 /**
  * @ngdoc directive
  * @function uiIf
  * 
  * @description 
  * Same as `ngIf` but evaluates condition against `SharedState` statuses too
  * 
  * @param {expression} uiIf A condition to decide wether to attach the element to the dom
  * @param {list} [uiScopeContext] A list `scopeVar[ as aliasName] [, ...]` specifing one of more scope variables to take into account when evaluating condition.
  */ 
  module.directive('uiIf', ['$animate', 'SharedState', '$parse', '$interpolate', function($animate, SharedState, $parse, $interpolate) {
    function getBlockNodes(nodes) {
      var node = nodes[0];
      var endNode = nodes[nodes.length - 1];
      var blockNodes = [node];
      do {
        node = node.nextSibling;
        if (!node) { break; }
        blockNodes.push(node);
      } while (node !== endNode);

      return angular.element(blockNodes);
    }

    return {
      multiElement: true,
      transclude: 'element',
      priority: 600,
      terminal: true,
      restrict: 'A',
      $$tlb: true,
      link: function ($scope, $element, $attr, ctrl, $transclude) {
          var block, childScope, previousElements, 
          uiIfFn = parseUiCondition('uiIf', $attr, $scope, SharedState, $parse, $interpolate);

          $scope.$watch(uiIfFn, function uiIfWatchAction(value) {
            if (value) {
              if (!childScope) {
                $transclude(function (clone, newScope) {
                  childScope = newScope;
                  clone[clone.length++] = document.createComment(' end uiIf: ' + $attr.uiIf + ' ');
                  // Note: We only need the first/last node of the cloned nodes.
                  // However, we need to keep the reference to the jqlite wrapper as it might be changed later
                  // by a directive with templateUrl when its template arrives.
                  block = {
                    clone: clone
                  };
                  $animate.enter(clone, $element.parent(), $element);
                });
              }
            } else {
              if (previousElements) {
                previousElements.remove();
                previousElements = null;
              }
              if (childScope) {
                childScope.$destroy();
                childScope = null;
              }
              if (block) {
                previousElements = getBlockNodes(block.clone);
                var done = function() {
                  previousElements = null;
                };
                var nga = $animate.leave(previousElements, done);
                if (nga) {
                  nga.then(done);
                }
                block = null;
              }
            }
          });
      }
    };
  }]);

  
  /**
   * @ngdoc directive 
   * @function uiHide
   * 
   * @description
   * Same as `ngHide` but evaluates condition against `SharedState` statuses
   * 
   * @param {expression} uiShow A condition to decide wether to hide the element
   * @param {list} [uiScopeContext] A list `scopeVar[ as aliasName] [, ...]` specifing one of more scope variables to take into account when evaluating condition.
   */ 
  module.directive('uiHide', ['$animate', 'SharedState', '$parse', '$interpolate', function($animate, SharedState, $parse, $interpolate) {
    var NG_HIDE_CLASS = 'ng-hide';
    var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';

    return {
      restrict: 'A',
      multiElement: true,
      link: function(scope, element, attr) {
        var uiHideFn = parseUiCondition('uiHide', attr, scope, SharedState, $parse, $interpolate);
        scope.$watch(uiHideFn, function uiHideWatchAction(value){
          $animate[value ? 'addClass' : 'removeClass'](element,NG_HIDE_CLASS, {
            tempClasses : NG_HIDE_IN_PROGRESS_CLASS
          });
        });
      }
    };
  }]);

  /**
   * @ngdoc directive 
   * @function uiShow
   * 
   * @description
   * Same as `ngShow` but evaluates condition against `SharedState` statuses
   * 
   * @param {expression} uiShow A condition to decide wether to show the element
   * @param {list} [uiScopeContext] A list `scopeVar[ as aliasName] [, ...]` specifing one of more scope variables to take into account when evaluating condition.
   */ 
  module.directive('uiShow', ['$animate', 'SharedState', '$parse', '$interpolate', function($animate, SharedState, $parse) {
    var NG_HIDE_CLASS = 'ng-hide';
    var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';

    return {
      restrict: 'A',
      multiElement: true,
      link: function(scope, element, attr) {
        var uiShowFn = parseUiCondition('uiShow', attr, scope, SharedState, $parse);
        scope.$watch(uiShowFn, function uiShowWatchAction(value){
          $animate[value ? 'removeClass' : 'addClass'](element, NG_HIDE_CLASS, {
            tempClasses : NG_HIDE_IN_PROGRESS_CLASS
          });
        });
      }
    };
  }]);

  /**
   * @ngdoc directive 
   * @function uiClass
   * 
   * @description
   * A simplified version of `ngClass` that evaluates in context of `SharedState`, it only suppors the `{'className': expr}` syntax.
   * 
   * @param {expression} uiClass An expression that has to evaluate to an object of the form `{'className': expr}`, where `expr` decides wether the class should appear to element's class list.
   * @param {list} [uiScopeContext] A list `scopeVar[ as aliasName] [, ...]` specifing one of more scope variables to take into account when evaluating condition.
   */ 
  module.directive('uiClass', ['SharedState', '$parse', '$interpolate', function(SharedState, $parse) {
    return {
      restrict: 'A',
      link: function(scope, element, attr) {
        var uiClassFn = parseUiCondition('uiClass', attr, scope, SharedState, $parse);
        scope.$watch(uiClassFn, function uiClassWatchAction(value){
          var classesToAdd = '';
          var classesToRemove = '';
          angular.forEach(value, function(expr, className) {
            if (expr) {
              classesToAdd += ' ' + className;
            } else {
              classesToRemove += ' ' + className;
            }
            classesToAdd = classesToAdd.trim();
            classesToRemove = classesToRemove.trim();
            if (classesToAdd.length) {
              element.addClass(classesToAdd);  
            }
            if (classesToRemove.length) {
              element.removeClass(classesToRemove);
            }
          });
        }, true);
      }
    };
  }]);

  module.run([
    '$rootScope',
    'SharedState',
    function($rootScope, SharedState){
      $rootScope.Ui = SharedState;
    }
  ]);


}());

/**
 * Provides directives and service to prevent touchmove default behaviour 
 * for touch devices (ie. bounce on overscroll in IOS).
 *
 * #### Usage
 *
 * Use `ui-prevent-touchmove-defaults` directive on root element of your app:
 * 
 * ``` html
 * <body ng-app='myApp' ui-prevent-touchmove-defaults>
 *   <!-- ... -->
 * </body>
 * ```
 *
 * Doing so `touchmove.preventDefault` logic for inner elements is inverted,
 * so any `touchmove` default behaviour is automatically prevented.
 * 
 * If you wish to allow the default behaviour, for example to allow 
 * inner elements to scroll, you have to explicitly mark an event to allow 
 * touchmove default.
 *
 * Mobile Angular UI already handles this for `scrollable` elements, so you don't have
 * to do anything in order to support scroll.
 *
 * If you wish to allow touchmove defaults for certain element under certain conditions
 * you can use the `allowTouchmoveDefault` service.
 *
 * ie.
 * 
 * ``` js
 * // always allow touchmove default for an element
 * allowTouchmoveDefault(myelem);
 * ```
 * 
 * ``` js
 * // allow touchmove default for an element only under certain conditions
 * allowTouchmoveDefault(myelem, function(touchmove){
 *   return touchmove.pageY > 100;
 * });
 * ```
 * 
 * @module mobile-angular-ui.core.touchmoveDefaults
 */
(function () {
  'use strict';
  var module = angular.module('mobile-angular-ui.core.touchmoveDefaults', []);

  module.directive('uiPreventTouchmoveDefaults', function() {
    var preventTouchmoveDefaultsCb = function(e) {
      if (e.allowTouchmoveDefault !== true) {
        e.preventDefault();
      }
    };

    return {
      compile: function(element) {
        if ('ontouchmove' in document) {
          element.on('touchmove', preventTouchmoveDefaultsCb);
        }
      }
    };
  });

  /**
   * Bind a listener to an element to allow `touchmove` default behaviour
   * when `touchmove` happens inside the bound element.
   * 
   * You can also provide a function to decide when to allow and 
   * when to prevent it.
   *
   * ``` js
   * // always allow touchmove default
   * allowTouchmoveDefault(myelem);
   * 
   * // allow touchmove default only under certain conditions
   * allowTouchmoveDefault(myelem, function(touchmove){
   *   return touchmove.pageY > 100;
   * });
   * ```
   *
   * @param {Element|$element} element The element to bind.
   * @param {function} condition A `function(touchmove)⟶boolean` to decide
   *                             whether to allow default behavior or not. 
   * 
   * @service allowTouchmoveDefault
   * @as function
   * @returns function Function to unbind the listener
   */
  
  module.factory('allowTouchmoveDefault', function(){
    var fnTrue = function() { return true; };

    if ('ontouchmove' in document) {
        return function($element, condition) {
          condition = condition || fnTrue;

          var allowTouchmoveDefaultCallback = function(e) {
            if (condition(e)) { e.allowTouchmoveDefault = true; }
          };

          $element = angular.element($element);
          $element.on('touchmove',  allowTouchmoveDefaultCallback);

          $element.on('$destroy', function() {
            $element.off('touchmove', allowTouchmoveDefaultCallback);
            $element = null;
          });

          return function() {
            if ($element) {
              $element.off('touchmove', allowTouchmoveDefaultCallback);              
            }
          };
        };
    } else {
      return angular.noop;
    }
  });

}());
/**

@module mobile-angular-ui.core

@description

It has all the core functionalities of Mobile Angular UI. It aims to act as a common base 
for an UI framework providing services and directives to create components and implement 
UI interactions with angular.

<div class="alert alert-success">
  <b>NOTE</b>
  <ul>
    <li>It has no dependency on Bootstrap.</li>
    <li>It is not related to mobile apps only.</li>
    <li>It is not requiring CSS support.</li>
    <li><b>You can use it on any Angular Application and with any CSS framework.</b></li>
  </ul>
</div>

## Standalone Usage

Although `.core` module is required by `mobile-angular-ui` by default you can use it alone.

``` js
angular.module('myApp', ['mobile-angular-ui.core']);
```

*/
(function () {
  'use strict';
  angular.module('mobile-angular-ui.core', [
    'mobile-angular-ui.core.fastclick',
    'mobile-angular-ui.core.activeLinks',
    'mobile-angular-ui.core.capture',
    'mobile-angular-ui.core.outerClick',
    'mobile-angular-ui.core.sharedState',
    'mobile-angular-ui.core.touchmoveDefaults'
  ]);
}());
/*! Overthrow. An overflow:auto polyfill for responsive design. (c) 2012: Scott Jehl, Filament Group, Inc. http://filamentgroup.github.com/Overthrow/license.txt */
(function( w, undefined ){
	
	var doc = w.document,
		docElem = doc.documentElement,
		enabledClassName = "overthrow-enabled",

		// Touch events are used in the polyfill, and thus are a prerequisite
		canBeFilledWithPoly = "ontouchmove" in doc,
		
		// The following attempts to determine whether the browser has native overflow support
		// so we can enable it but not polyfill
		nativeOverflow = 
			// Features-first. iOS5 overflow scrolling property check - no UA needed here. thanks Apple :)
			"WebkitOverflowScrolling" in docElem.style ||
			// Test the windows scrolling property as well
			"msOverflowStyle" in docElem.style ||
			// Touch events aren't supported and screen width is greater than X
			// ...basically, this is a loose "desktop browser" check. 
			// It may wrongly opt-in very large tablets with no touch support.
			( !canBeFilledWithPoly && w.screen.width > 800 ) ||
			// Hang on to your hats.
			// Whitelist some popular, overflow-supporting mobile browsers for now and the future
			// These browsers are known to get overlow support right, but give us no way of detecting it.
			(function(){
				var ua = w.navigator.userAgent,
					// Webkit crosses platforms, and the browsers on our list run at least version 534
					webkit = ua.match( /AppleWebKit\/([0-9]+)/ ),
					wkversion = webkit && webkit[1],
					wkLte534 = webkit && wkversion >= 534;
					
				return (
					/* Android 3+ with webkit gte 534
					~: Mozilla/5.0 (Linux; U; Android 3.0; en-us; Xoom Build/HRI39) AppleWebKit/534.13 (KHTML, like Gecko) Version/4.0 Safari/534.13 */
					ua.match( /Android ([0-9]+)/ ) && RegExp.$1 >= 3 && wkLte534 ||
					/* Blackberry 7+ with webkit gte 534
					~: Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en-US) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.0.0 Mobile Safari/534.11+ */
					ua.match( / Version\/([0-9]+)/ ) && RegExp.$1 >= 0 && w.blackberry && wkLte534 ||
					/* Blackberry Playbook with webkit gte 534
					~: Mozilla/5.0 (PlayBook; U; RIM Tablet OS 1.0.0; en-US) AppleWebKit/534.8+ (KHTML, like Gecko) Version/0.0.1 Safari/534.8+ */   
					ua.indexOf( "PlayBook" ) > -1 && wkLte534 && !ua.indexOf( "Android 2" ) === -1 ||
					/* Firefox Mobile (Fennec) 4 and up
					~: Mozilla/5.0 (Mobile; rv:15.0) Gecko/15.0 Firefox/15.0 */
					ua.match(/Firefox\/([0-9]+)/) && RegExp.$1 >= 4 ||
					/* WebOS 3 and up (TouchPad too)
					~: Mozilla/5.0 (hp-tablet; Linux; hpwOS/3.0.0; U; en-US) AppleWebKit/534.6 (KHTML, like Gecko) wOSBrowser/233.48 Safari/534.6 TouchPad/1.0 */
					ua.match( /wOSBrowser\/([0-9]+)/ ) && RegExp.$1 >= 233 && wkLte534 ||
					/* Nokia Browser N8
					~: Mozilla/5.0 (Symbian/3; Series60/5.2 NokiaN8-00/012.002; Profile/MIDP-2.1 Configuration/CLDC-1.1 ) AppleWebKit/533.4 (KHTML, like Gecko) NokiaBrowser/7.3.0 Mobile Safari/533.4 3gpp-gba 
					~: Note: the N9 doesn't have native overflow with one-finger touch. wtf */
					ua.match( /NokiaBrowser\/([0-9\.]+)/ ) && parseFloat(RegExp.$1) === 7.3 && webkit && wkversion >= 533
				);
			})();

	// Expose overthrow API
	w.overthrow = {};

	w.overthrow.enabledClassName = enabledClassName;

	w.overthrow.addClass = function(){
		if( docElem.className.indexOf( w.overthrow.enabledClassName ) === -1 ){
			docElem.className += " " + w.overthrow.enabledClassName;
		}
	};

	w.overthrow.removeClass = function(){
		docElem.className = docElem.className.replace( w.overthrow.enabledClassName, "" );
	};

	// Enable and potentially polyfill overflow
	w.overthrow.set = function(){
			
		// If nativeOverflow or at least the element canBeFilledWithPoly, add a class to cue CSS that assumes overflow scrolling will work (setting height on elements and such)
		if( nativeOverflow ){
			w.overthrow.addClass();
		}

	};

	// expose polyfillable 
	w.overthrow.canBeFilledWithPoly = canBeFilledWithPoly;

	// Destroy everything later. If you want to.
	w.overthrow.forget = function(){

		w.overthrow.removeClass();
		
	};
		
	// Expose overthrow API
	w.overthrow.support = nativeOverflow ? "native" : "none";
		
})( this );

/*! Overthrow. An overflow:auto polyfill for responsive design. (c) 2012: Scott Jehl, Filament Group, Inc. http://filamentgroup.github.com/Overthrow/license.txt */
(function( w, undefined ){
	
	// Auto-init
	w.overthrow.set();

}( this ));
/*! Overthrow. An overflow:auto polyfill for responsive design. (c) 2012: Scott Jehl, Filament Group, Inc. http://filamentgroup.github.com/Overthrow/license.txt */
(function( w, o, undefined ){

	// o is overthrow reference from overthrow-polyfill.js
	if( o === undefined ){
		return;
	}

	o.scrollIndicatorClassName = "overthrow";
	
	var doc = w.document,
		docElem = doc.documentElement,
		// o api
		nativeOverflow = o.support === "native",
		canBeFilledWithPoly = o.canBeFilledWithPoly,
		configure = o.configure,
		set = o.set,
		forget = o.forget,
		scrollIndicatorClassName = o.scrollIndicatorClassName;

	// find closest overthrow (elem or a parent)
	o.closest = function( target, ascend ){
		return !ascend && target.className && target.className.indexOf( scrollIndicatorClassName ) > -1 && target || o.closest( target.parentNode );
	};
		
	// polyfill overflow
	var enabled = false;
	o.set = function(){
			
		set();

		// If nativeOverflow or it doesn't look like the browser canBeFilledWithPoly, our job is done here. Exit viewport left.
		if( enabled || nativeOverflow || !canBeFilledWithPoly ){
			return;
		}

		w.overthrow.addClass();

		enabled = true;

		o.support = "polyfilled";

		o.forget = function(){
			forget();
			enabled = false;
			// Remove touch binding (check for method support since this part isn't qualified by touch support like the rest)
			if( doc.removeEventListener ){
				doc.removeEventListener( "touchstart", start, false );
			}
		};

		// Fill 'er up!
		// From here down, all logic is associated with touch scroll handling
			// elem references the overthrow element in use
		var elem,
			
			// The last several Y values are kept here
			lastTops = [],
	
			// The last several X values are kept here
			lastLefts = [],
			
			// lastDown will be true if the last scroll direction was down, false if it was up
			lastDown,
			
			// lastRight will be true if the last scroll direction was right, false if it was left
			lastRight,
			
			// For a new gesture, or change in direction, reset the values from last scroll
			resetVertTracking = function(){
				lastTops = [];
				lastDown = null;
			},
			
			resetHorTracking = function(){
				lastLefts = [];
				lastRight = null;
			},
		
			// On webkit, touch events hardly trickle through textareas and inputs
			// Disabling CSS pointer events makes sure they do, but it also makes the controls innaccessible
			// Toggling pointer events at the right moments seems to do the trick
			// Thanks Thomas Bachem http://stackoverflow.com/a/5798681 for the following
			inputs,
			setPointers = function( val ){
				inputs = elem.querySelectorAll( "textarea, input" );
				for( var i = 0, il = inputs.length; i < il; i++ ) {
					inputs[ i ].style.pointerEvents = val;
				}
			},
			
			// For nested overthrows, changeScrollTarget restarts a touch event cycle on a parent or child overthrow
			changeScrollTarget = function( startEvent, ascend ){
				if( doc.createEvent ){
					var newTarget = ( !ascend || ascend === undefined ) && elem.parentNode || elem.touchchild || elem,
						tEnd;
							
					if( newTarget !== elem ){
						tEnd = doc.createEvent( "HTMLEvents" );
						tEnd.initEvent( "touchend", true, true );
						elem.dispatchEvent( tEnd );
						newTarget.touchchild = elem;
						elem = newTarget;
						newTarget.dispatchEvent( startEvent );
					}
				}
			},
			
			// Touchstart handler
			// On touchstart, touchmove and touchend are freshly bound, and all three share a bunch of vars set by touchstart
			// Touchend unbinds them again, until next time
			start = function( e ){

				// Stop any throw in progress
				if( o.intercept ){
					o.intercept();
				}
				
				// Reset the distance and direction tracking
				resetVertTracking();
				resetHorTracking();
				
				elem = o.closest( e.target );
					
				if( !elem || elem === docElem || e.touches.length > 1 ){
					return;
				}			

				setPointers( "none" );
				var touchStartE = e,
					scrollT = elem.scrollTop,
					scrollL = elem.scrollLeft,
					height = elem.offsetHeight,
					width = elem.offsetWidth,
					startY = e.touches[ 0 ].pageY,
					startX = e.touches[ 0 ].pageX,
					scrollHeight = elem.scrollHeight,
					scrollWidth = elem.scrollWidth,
				
					// Touchmove handler
					move = function( e ){
					
						var ty = scrollT + startY - e.touches[ 0 ].pageY,
							tx = scrollL + startX - e.touches[ 0 ].pageX,
							down = ty >= ( lastTops.length ? lastTops[ 0 ] : 0 ),
							right = tx >= ( lastLefts.length ? lastLefts[ 0 ] : 0 );
							
						// If there's room to scroll the current container, prevent the default window scroll
						if( ( ty > 0 && ty < scrollHeight - height ) || ( tx > 0 && tx < scrollWidth - width ) ){
							e.preventDefault();
						}
						// This bubbling is dumb. Needs a rethink.
						else {
							changeScrollTarget( touchStartE );
						}
						
						// If down and lastDown are inequal, the y scroll has changed direction. Reset tracking.
						if( lastDown && down !== lastDown ){
							resetVertTracking();
						}
						
						// If right and lastRight are inequal, the x scroll has changed direction. Reset tracking.
						if( lastRight && right !== lastRight ){
							resetHorTracking();
						}
						
						// remember the last direction in which we were headed
						lastDown = down;
						lastRight = right;							
						
						// set the container's scroll
						elem.scrollTop = ty;
						elem.scrollLeft = tx;
					
						lastTops.unshift( ty );
						lastLefts.unshift( tx );
					
						if( lastTops.length > 3 ){
							lastTops.pop();
						}
						if( lastLefts.length > 3 ){
							lastLefts.pop();
						}
					},
				
					// Touchend handler
					end = function( e ){

						// Bring the pointers back
						setPointers( "auto" );
						setTimeout( function(){
							setPointers( "none" );
						}, 450 );
						elem.removeEventListener( "touchmove", move, false );
						elem.removeEventListener( "touchend", end, false );
					};
				
				elem.addEventListener( "touchmove", move, false );
				elem.addEventListener( "touchend", end, false );
			};
			
		// Bind to touch, handle move and end within
		doc.addEventListener( "touchstart", start, false );
	};
		
})( this, this.overthrow );

/**
 * This module will provide directives to create modals and overlays components.
 * 
 * @module mobile-angular-ui.components.modals
 */
(function () {
  'use strict';
  angular.module('mobile-angular-ui.components.modals', [])

  /**
   * A directive to create modals and overlays components.
   * 
   * Modals are basically the same of Bootstrap 3 but you have to use uiState 
   * with `ngIf/uiIf` or `ngHide/uiHide` to `activate/dismiss` it.
   * 
   * By default both modals and overlay are made always showing up by 
   * css rule `.modal {display:block}`, so you can use it with 
   * `ngAnimate` and other angular directives in a simpler way.
   *
   * Overlay are a style of modal that looks more native in mobile devices providing a blurred
   * overlay as background.
   * 
   * You can create an overlay adding `.modal-overlay` class to a modal.
   * 
   * ### Note
   * 
   * For modals and overlays to cover the entire page you have to attach them 
   * as child of `body` element. To achieve this from a view is a common use for
   * `contentFor/yieldTo` directives contained from 
   * [capture module](/docs/module:mobile-angular-ui/module:core/module:capture):
   * 
   * ``` html
   * <body ng-app="myApp">
   * 
   *   <!-- ... -->
   *   <!-- Modals and Overlays -->
   *   <div ui-yield-to="modals"></div>
   * 
   * </body>
   * ```
   * 
   * Then you can wrap your modals and overlays in `contentFor`:
   * 
   * ``` html
   * <div ui-content-for="modals">
   * * <div class="modal"><!-- ... --></div>
   * </div>
   * ```
   * 
   * **Example.** Create a Modal.
   * 
   * ``` html
   * <div ui-content-for="modals">
   *   <div class="modal" ui-if="modal1" ui-state='modal1'>
   *     <div class="modal-backdrop in"></div>
   *     <div class="modal-dialog">
   *       <div class="modal-content">
   *         <div class="modal-header">
   *           <button class="close" 
   *                   ui-turn-off="modal1">&times;</button>
   *           <h4 class="modal-title">Modal title</h4>
   *         </div>
   *         <div class="modal-body">
   *           <p>Lorem ipsum ...</p>
   *         </div>
   *         <div class="modal-footer">
   *           <button ui-turn-off="modal1" class="btn btn-default">Close</button>
   *           <button ui-turn-off="modal1" class="btn btn-primary">Save changes</button>
   *         </div>
   *       </div>
   *     </div>
   *   </div>
   * </div>
   * ```
   * 
   * **Example.** Create an Overlay.
   * 
   * ``` html
   * <div ui-content-for="modals">
   *   <div class="modal modal-overlay" ui-if='modal2' ui-state='modal2'>
   *     <div class="modal-dialog">
   *       <div class="modal-content">
   *         <div class="modal-header">
   *           <button class="close"
   *                   ui-turn-off="modal2">&times;</button>
   *           <h4 class="modal-title">Modal title</h4>
   *         </div>
   *         <div class="modal-body">
   *           <p>Lorem ipsum ...</p>
   *         </div>
   *         <div class="modal-footer">
   *           <button ui-turn-off="modal2" class="btn btn-default">Close</button>
   *           <button ui-turn-off="modal2" class="btn btn-primary">Save changes</button>
   *         </div>
   *       </div>
   *     </div>
   *   </div>
   * </div>
   * ```
   * 
   * @directive modal
   * @restrict C
   */
  .directive('modal', [
    '$rootElement',
    function($rootElement) {
      return {
        restrict: 'C',
        link: function(scope, elem) {
          $rootElement.addClass('has-modal');
          elem.on('$destroy', function(){
            $rootElement.removeClass('has-modal');
          });
          scope.$on('$destroy', function(){
            $rootElement.removeClass('has-modal');
          });

          if (elem.hasClass('modal-overlay')) {
            $rootElement.addClass('has-modal-overlay');
            elem.on('$destroy', function(){
              $rootElement.removeClass('has-modal-overlay');
            });
            scope.$on('$destroy', function(){
              $rootElement.removeClass('has-modal-overlay');
            });            
          }
        }
      };
  }]);
}());
/** 
 * @module mobile-angular-ui.components.navbars 
 * @description
 * 
 * Bootstrap default navbars are awesome for responsive websites, but are not the
 * best with a small screen. Also fixed positioning is yet not an option to create
 * navbars standing in top or bottom of the screen.
 * 
 * Mobile Angular Ui offers an alternative to bootstrap navbars that is more
 * suitable for mobile.
 * 
 * It uses scrollable areas to avoid scroll issues. In the following figure you can
 * see the difference between fixed navbars and navbars with absolute positioning.
 * 
 * <figure class="full-width-figure">
 *   <img src="/assets/img/figs/fixed-overflow.png" alt=""/>
 * </figure>
 * 
 * Here is the basic markup to achieve this.
 * 
 * ``` html
 * <div class="app">
 *   <div class="navbar navbar-app navbar-absolute-top">
 *     <!-- ... -->
 *   </div>
 * 
 *   <div class="navbar navbar-app navbar-absolute-bottom">
 *     <!-- ... -->
 *   </div>
 * 
 *   <div class="app-body">
 *     <ng-view></ng-view>
 *   </div>
 * </div>
 * ```
 * 
 * As you can notice the base class is `.navbar-app` while the positioning is
 * obtained adding either `.navbar-absolute-top` or `.navbar-absolute-bottom`
 * class.
 * 
 * ### Mobile Navbar Layout
 * 
 * Top navbar in mobile design most of the times follows a clear pattern: a
 * centered title surrounded by one or two action buttons, the _back_ or the
 * _menu_ buttons are two common examples.
 * 
 * Twitter Bootstrap ships with a different arrangement of components for navbars
 * since they are supposed to host an horizontal navigation menu.
 * 
 * `.navbar-app` is specifically designed to support this different type of
 * `.interaction and arrangement.
 * 
 * Consider the following example:
 * 
 * ``` html
 * <div class="navbar navbar-app navbar-absolute-top">
 * 
 *   <div class="navbar-brand navbar-brand-center">
 *     Navbar Brand
 *   </div>
 * 
 *   <div class="btn-group pull-left">
 *     <div class="btn btn-navbar">
 *       Left Action
 *     </div>
 *   </div>
 * 
 *   <div class="btn-group pull-right">
 *     <div class="btn btn-navbar">
 *       Right Action
 *     </div>
 *   </div>
 * </div>
 * 
 * ```
 * 
 * `.navbar-brand-center` is a specialization of BS3's `.navbar-brand`.  It will
 * render the title centered and below the two button groups. Note that `.navbar-
 * brand-center` will position the title with absolute positioning ensuring that
 * it will never cover the buttons, which would cause interaction problems.
 * 
 */

(function() {
  'use strict';

  var module = angular.module('mobile-angular-ui.components.navbars', []);

 /** 
  * @directive navbarAbsoluteTop
  * @restrict C
  * @description
  *
  * Setup absolute positioned top navbar.
  * 
  * ``` html
  *  <div class="navbar navbar-app navbar-absolute-top">
  *    <!-- ... -->
  *  </div>
  * ``` 
  */

 /** 
  * @directive navbarAbsoluteBottom
  * @restrict C
  * @description
  * 
  * Setup absolute positioned bottom navbar.
  * 
  * ``` html
  *  <div class="navbar navbar-app navbar-absolute-bottom">
  *    <!-- ... -->
  *  </div>
  * ``` 
  */
  angular.forEach(['top', 'bottom'], function(side) {
    var directiveName = 'navbarAbsolute' + side.charAt(0).toUpperCase() + side.slice(1);
    module.directive(directiveName, [
      '$rootElement',
      function($rootElement) {
        return {
          restrict: 'C',
          link: function(scope) {
            $rootElement.addClass('has-navbar-' + side);
            scope.$on('$destroy', function(){
              $rootElement.removeClass('has-navbar-' + side);
            });
            }
          };
        }
    ]);
  });

})();
/**  
 * @module mobile-angular-ui.components.scrollable
 * @description
 * 
 * One thing you'll always have to deal with approaching mobile web app development is scroll and `position:fixed` bugs.
 * 
 * Due to the lack of support in some devices fixed positioned elements may bounce or disappear during scroll. Also mobile interaction often leverages horizontal scroll eg. in carousels or sliders.
 * 
 * We use `overflow:auto` to create scrollable areas and solve any problems related to scroll.
 * 
 * Since `overflow:auto` is not always available in touch devices we use [Overthrow](http://filamentgroup.github.io/Overthrow/) to polyfill that.
 * 
 * Markup for any scrollable areas is as simple as:
 * 
 * ``` html
 * <div class="scrollable">
 *   <div class="scrollable-content">...</div>
 * </div>
 * ```
 * 
 * This piece of code will trigger a directive that properly setup a new `Overthrow` instance for the `.scrollable` node.
 * 
 * #### Headers and footers
 * 
 * `.scrollable-header/.scrollable-footer` can be used to add fixed header/footer to a scrollable area without having to deal with css height and positioning to avoid breaking scroll.
 * 
 * ``` html
 * <div class="scrollable">
 *   <div class="scrollable-header"><!-- ... --></div>
 *   <div class="scrollable-content"><!-- ... --></div>
 *   <div class="scrollable-footer"><!-- ... --></div>
 * </div>
 * ```
 * 
 * #### scrollTo
 * 
 * `.scrollable-content` controller exposes a `scrollTo` function: `scrollTo(offsetOrElement, margin)` 
 * 
 * You have to require it in your directives to use it or obtain through `element().controller`:
 * 
 * ``` js
 * var elem = element(document.getElementById('myScrollableContent'));
 * var scrollableContentController = elem.controller('scrollableContent');
 * 
 * // - Scroll to top of containedElement
 * scrollableContentController.scrollTo(containedElement);
 * 
 * // - Scroll to top of containedElement with a margin of 10px;
 * scrollableContentController.scrollTo(containedElement, 10);
 * 
 * // - Scroll top by 200px;
 * scrollableContentController.scrollTo(200);
 * ```
 * 
 * #### `ui-scroll-bottom/ui-scroll-top`
 * 
 * You can use `ui-scroll-bottom/ui-scroll-top` directives handle that events and implement features like _infinite scroll_.
 * 
 * ``` html
 * <div class="scrollable">
 *   <div class="scrollable-content section" ui-scroll-bottom="loadMore()">
 *     <ul>
 *       <li ng-repeat="item in items">
 *         {{item.name}}
 *       </li>
 *     </ul>
 *   </div>
 * </div>
 * ```
 */
(function() {
  'use strict';
  var module = angular.module('mobile-angular-ui.components.scrollable', 
    ['mobile-angular-ui.core.touchmoveDefaults']);


  var getTouchY = function(event) {
    var touches = event.touches && event.touches.length ? event.touches : [event];
    var e = (event.changedTouches && event.changedTouches[0]) ||
        (event.originalEvent && event.originalEvent.changedTouches &&
            event.originalEvent.changedTouches[0]) ||
        touches[0].originalEvent || touches[0];

    return e.clientY;
  };

  module.directive('scrollableContent', function() {
    return {
      restrict: 'C',
      controller: ['$element', 'allowTouchmoveDefault', function($element, allowTouchmoveDefault) {
        var scrollableContent = $element[0],
            scrollable = $element.parent()[0];

        // Handle nobounce behaviour
        if ('ontouchmove' in document) {
          var allowUp, allowDown, prevTop, prevBot, lastY;
          var setupTouchstart = function(event) {
            allowUp = (scrollableContent.scrollTop > 0);

            allowDown = (scrollableContent.scrollTop < scrollableContent.scrollHeight - scrollableContent.clientHeight);
            prevTop = null; 
            prevBot = null;
            lastY = getTouchY(event);
          };

          $element.on('touchstart', setupTouchstart);
          $element.on('$destroy', function() {
            $element.off('touchstart');
          });

          allowTouchmoveDefault($element, function(event) {
            var currY = getTouchY(event);
            var up = (currY > lastY), down = !up;
            lastY = currY;
            return (up && allowUp) || (down && allowDown);
          });
        }

        this.scrollableContent = scrollableContent;

        this.scrollTo = function(elementOrNumber, marginTop) {
          marginTop = marginTop || 0;

          if (angular.isNumber(elementOrNumber)) {
            scrollableContent.scrollTop = elementOrNumber - marginTop;
          } else {
            var target = angular.element(elementOrNumber)[0];
            if ((! target.offsetParent) || target.offsetParent === scrollable) {
              scrollableContent.scrollTop = target.offsetTop - marginTop;
            } else {
              // recursively subtract offsetTop from marginTop until it reaches scrollable element.
              this.scrollTo(target.offsetParent, marginTop - target.offsetTop);
            }
          }
        };
      }],
      link: function(scope, element) {
        if (overthrow.support !== 'native') {
          element.addClass('overthrow');
          overthrow.forget();
          overthrow.set();
        }
      }
    };
  });

  angular.forEach(['input', 'textarea'], function(directiveName) {
    module.directive(directiveName, ['$rootScope','$timeout', function($rootScope, $timeout) {
      return {
        require: '?^^scrollableContent',
        link: function(scope, elem, attrs, scrollable) {
          // Workaround to avoid soft keyboard hiding inputs
          elem.on('focus', function(){
            if (scrollable && scrollable.scrollableContent) {
              var h1 = scrollable.scrollableContent.offsetHeight;
              $timeout(function() {
                var h2 = scrollable.scrollableContent.offsetHeight;
                // 
                // if scrollableContent height is reduced in half second
                // since an input got focus we assume soft keyboard is showing.
                //
                if (h1 > h2) {
                  scrollable.scrollTo(elem, 10);  
                }
              }, 500);              
            }
          });
        }
      };
    }]);
  });

  /**
   * @directive uiScrollTop
   * @restrict A
   *
   * @param {expression} uiScrollTop The expression to be evaluated when scroll 
   * reaches top of element.
   */

  /**
   * @directive uiScrollBottom
   * @restrict A
   *
   * @param {expression} uiScrollBottom The expression to be evaluated when scroll 
   * reaches bottom of element.
   */
  angular.forEach(
    {
      uiScrollTop: function(elem){
        return elem.scrollTop === 0;
      }, 
      uiScrollBottom: function(elem){
        return elem.scrollHeight === elem.scrollTop + elem.clientHeight;
      }
    }, 
    function(reached, directiveName){
      module.directive(directiveName, [function() {
        return {
          restrict: 'A',
          link: function(scope, elem, attrs) {
            elem.on('scroll', function(){
              /* If reached bottom */
              if ( reached(elem[0]) ) {
                /* Do what is specified by onScrollBottom */
                scope.$apply(function(){
                  scope.$eval(attrs[directiveName]);
                });
              }
            });
          }
        };
      }]);
    });

  /**
   * @directive uiScrollableHeader
   * @restrict C
   */

  /**
   * @directive uiScrollableFooter
   * @restrict C
   */
  angular.forEach({Top: 'scrollableHeader', Bottom: 'scrollableFooter'}, 
    function(directiveName, side) {
        module.directive(directiveName, [
          '$window',
          function($window) {
                  return {
                    restrict: 'C',
                    link: function(scope, element) {
                      var el = element[0],
                          parentStyle = element.parent()[0].style;

                      var adjustParentPadding = function() {
                        var styles = $window.getComputedStyle(el),
                            margin = parseInt(styles.marginTop, 10) + parseInt(styles.marginBottom, 10);
                        parentStyle['padding' + side] = el.offsetHeight + margin + 'px';
                      };

                      var interval = setInterval(adjustParentPadding, 30);

                      element.on('$destroy', function(){
                        parentStyle['padding' + side] = null;
                        clearInterval(interval);
                        interval = adjustParentPadding = element = null;
                      });
                    }
                  };
                }
        ]);
    });
}());
/**
@module mobile-angular-ui.components.sidebars

@description

Sidebars can be placed either in left side or right side adding respectively `.sidebar-left` and `.sidebar-right` classes.

``` html
<div class="sidebar sidebar-left">
  <div class="scrollable">
    <h1 class="scrollable-header app-name">My App</h1>  
    <div class="scrollable-content">
      <div class="list-group" ui-turn-off='uiSidebarLeft'>
        <a class="list-group-item" href="#/link1">Link 1 
          <i class="fa fa-chevron-right pull-right"></i></a>
        <a class="list-group-item" href="#/link2">Link 2
          <i class="fa fa-chevron-right pull-right"></i></a>
      </div>
    </div>
  </div>
</div>

<div class="sidebar sidebar-rigth">
  <!-- -->
</div>
```

#### Interacting with sidebars

Under the hood sidebar uses `SharedState` exposing respective statuses: `uiSidebarLeft` and `uiSidebarRight` unless you define different state name through `id` attribute on sidebar elements.

``` html
<a href ui-toggle='uiSidebarLeft'>Toggle sidebar left</a>

<a href ui-toggle='uiSidebarRight'>Toggle sidebar right</a>
```

You can put `ui-turn-off='uiSidebarLeft'` or `ui-turn-off='uiSidebarLeft'` inside the sidebar to make it close after clicking links inside them.

By default sidebar are closed by clicking/tapping outside them.

*/
(function() {
  'use strict';

  var module = angular.module(
    'mobile-angular-ui.components.sidebars', [
      'mobile-angular-ui.core.sharedState',
      'mobile-angular-ui.core.outerClick'
    ]
  );

  angular.forEach(['left', 'right'], function (side) {
    var directiveName = 'sidebar' + side.charAt(0).toUpperCase() + side.slice(1);
    var stateName = 'ui' + directiveName.charAt(0).toUpperCase() + directiveName.slice(1);

    module.directive(directiveName, [
      '$rootElement',
      'SharedState',
      'bindOuterClick',
      '$location',
      function (
        $rootElement,
        SharedState,
        bindOuterClick,
        $location
      ) {  
        return {
          restrict: 'C',
          link: function (scope, elem, attrs) {
            var parentClass = 'has-sidebar-' + side;
            var visibleClass = 'sidebar-' + side + '-visible';
            var activeClass = 'sidebar-' + side + '-in';

            if (attrs.id) {
              stateName = attrs.id;
            }

            var outerClickCb = function (){
              SharedState.turnOff(stateName);
            };

            var outerClickIf = function() {
              return SharedState.isActive(stateName);
            };

            $rootElement.addClass(parentClass);
            scope.$on('$destroy', function () {
              $rootElement
                .removeClass(parentClass);
              $rootElement
                .removeClass(visibleClass);
              $rootElement
                .removeClass(activeClass);
            });

            var defaultActive = attrs.active !== undefined && attrs.active !== 'false';          
            SharedState.initialize(scope, stateName, {defaultValue: defaultActive});

            scope.$on('mobile-angular-ui.state.changed.' + stateName, function (e, active) {
              if (attrs.uiTrackAsSearchParam === '' || attrs.uiTrackAsSearchParam) {
                $location.search(stateName, active || null);
              }
              
              if (active) {
                $rootElement
                  .addClass(visibleClass);
                $rootElement
                  .addClass(activeClass);
              } else {
                $rootElement
                  .removeClass(activeClass);
                // Note: .removeClass(visibleClass) is called on 'mobile-angular-ui.app.transitionend'
              }
            });

            scope.$on('$routeChangeSuccess', function() {
              SharedState.turnOff(stateName);
            });

            scope.$on('$routeUpdate', function() {
              if (attrs.uiTrackAsSearchParam) {
                if (($location.search())[stateName]) {
                  SharedState.turnOn(stateName);
                } else {
                  SharedState.turnOff(stateName);
                }                
              }
            });

            scope.$on('mobile-angular-ui.app.transitionend', function() {
              if (!SharedState.isActive(stateName)) {
                $rootElement.removeClass(visibleClass);  
              }
            });

            if (attrs.closeOnOuterClicks !== 'false') {
              bindOuterClick(scope, elem, outerClickCb, outerClickIf);
            }
          }
        };
      }
    ]);
  });

  module.directive('app', ['$rootScope', function($rootScope) {
    return {
      restrict: 'C',
      link: function(scope, element) {
        
        element.on('transitionend webkitTransitionEnd oTransitionEnd otransitionend', function() {
          $rootScope.$broadcast('mobile-angular-ui.app.transitionend');
        });          

      }
    };
  }]);
}());
/**
 * A module with just a directive to create a switch input component.
 * 
 * @module mobile-angular-ui.components.switch
 */
(function() {
  'use strict';  
  angular.module('mobile-angular-ui.components.switch', [])

  /** 
   * @directive uiSwitch
   * @restrict EA
   * @requires ngModel
   * @description
   * 
   * The `ui-switch` directive (not to be confused with `ng-switch`) lets 
   * you create a toggle switch control bound to a boolean `ngModel` value.
   * 
   * <figure class="full-width-figure">
   *   <img src="/assets/img/figs/switch.png" alt=""/>
   * </figure>
   * 
   * It requires `ngModel`. It supports `ngChange` and `ngDisabled`.
   * 
   * ``` html
   * <ui-switch  ng-model="invoice.paid"></ui-switch>
   * ```
   * 
   * ``` html
   * <ui-switch  ng-model="invoice.paid" disabled></ui-switch>
   * ```
   * 
   * ``` html
   * <ui-switch  ng-model="invoice.paid" ng-disabled='{{...}}'></ui-switch>
   * ```
   * 
   * Note that if `$drag` service from `mobile-angular-ui.gestures` is available 
   * `ui-switch` will support drag too.
   * 
   * @param {expression} ngModel The model bound to this component.
   * @param {boolean} [disabled] Whether this component should be disabled.
   * @param {expression} [ngChange] An expression to be evaluated when model changes.
   */
  .directive('uiSwitch', ['$injector', function($injector) {
    var $drag = $injector.has('$drag') && $injector.get('$drag');

    return {
      restrict: 'EA',
      scope: {
        model: '=ngModel',
        changeExpr: '@ngChange'
      },
      link: function(scope, elem, attrs) {
        elem.addClass('switch');
        
        var disabled = attrs.disabled || elem.attr('disabled');

        var unwatchDisabled = scope.$watch(
          function() { 
            return attrs.disabled || elem.attr('disabled'); 
          },
          function(value) {
            if (!value || value === 'false' || value === '0') {
              disabled = false;
            } else {
              disabled = true;
            }
          }
        );

        var handle = angular.element('<div class="switch-handle"></div>');
        elem.append(handle);

        if (scope.model) {
          elem.addClass('active');
        }
        elem.addClass('switch-transition-enabled');

        var unwatch = scope.$watch('model', function(value) {
          if (value) {
            elem.addClass('active');
          } else {
            elem.removeClass('active');
          }
        });
        
        var isEnabled = function() {
          return !disabled;
        };

        var setModel = function(value) {
          if (isEnabled() && value !== scope.model) {
            scope.model = value;
            scope.$apply();
            if (scope.changeExpr !== null && scope.changeExpr !== undefined) {
              scope.$parent.$eval(scope.changeExpr);
            }
          }
        };

        var clickCb = function() {
          setModel(!scope.model);
        };

        elem.on('click tap', clickCb);

        var unbind = angular.noop;

        if ($drag) {
          unbind = $drag.bind(handle, {
            transform: $drag.TRANSLATE_INSIDE(elem),
            start: function() {
              elem.off('click tap', clickCb);
            },
            cancel: function() {
              handle.removeAttr('style');
              elem.off('click tap', clickCb);
              elem.on('click tap', clickCb);
            },
            end: function() {
              var rh = handle[0].getBoundingClientRect();
              var re = elem[0].getBoundingClientRect();
              if (rh.left - re.left < rh.width / 3) {
                setModel(false);
                handle.removeAttr('style');
              } else if (re.right - rh.right < rh.width / 3) {
                setModel(true);
                handle.removeAttr('style');
              } else {
                handle.removeAttr('style');
              }
              elem.on('click tap', clickCb);
            }
          });  
        }

        elem.on('$destroy', function() {
          unbind();
          unwatchDisabled();
          unwatch();
          isEnabled = setModel = unbind = unwatch = unwatchDisabled = clickCb = null;
        });
      }
    };
  }]);
}());
/**
@module mobile-angular-ui.components

@description

It has directives and services providing mobile friendly 
components like navbars and sidebars. 
It requires `mobile-angular-ui.base.css` 
in order to work properly.

## Standalone Usage

Although `.components` module is required by `mobile-angular-ui` by default 
you can use it alone. Some submodules requires `mobile-angular-ui.core` to work,
so be sure its sources are available.

``` js
angular.module('myApp', ['mobile-angular-ui.components']);
```

*/
(function() {
  'use strict';

  angular.module('mobile-angular-ui.components', [
    'mobile-angular-ui.components.modals',
    'mobile-angular-ui.components.navbars',
    'mobile-angular-ui.components.sidebars',
    'mobile-angular-ui.components.scrollable',
    'mobile-angular-ui.components.switch'
  ]);
}());
/*!
 * clipboard.js v1.7.1
 * https://zenorocha.github.io/clipboard.js
 *
 * Licensed MIT © Zeno Rocha
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Clipboard = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var DOCUMENT_NODE_TYPE = 9;

/**
 * A polyfill for Element.matches()
 */
if (typeof Element !== 'undefined' && !Element.prototype.matches) {
    var proto = Element.prototype;

    proto.matches = proto.matchesSelector ||
                    proto.mozMatchesSelector ||
                    proto.msMatchesSelector ||
                    proto.oMatchesSelector ||
                    proto.webkitMatchesSelector;
}

/**
 * Finds the closest parent that matches a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @return {Function}
 */
function closest (element, selector) {
    while (element && element.nodeType !== DOCUMENT_NODE_TYPE) {
        if (typeof element.matches === 'function' &&
            element.matches(selector)) {
          return element;
        }
        element = element.parentNode;
    }
}

module.exports = closest;

},{}],2:[function(require,module,exports){
var closest = require('./closest');

/**
 * Delegates event to a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @param {Boolean} useCapture
 * @return {Object}
 */
function delegate(element, selector, type, callback, useCapture) {
    var listenerFn = listener.apply(this, arguments);

    element.addEventListener(type, listenerFn, useCapture);

    return {
        destroy: function() {
            element.removeEventListener(type, listenerFn, useCapture);
        }
    }
}

/**
 * Finds closest match and invokes callback.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Function}
 */
function listener(element, selector, type, callback) {
    return function(e) {
        e.delegateTarget = closest(e.target, selector);

        if (e.delegateTarget) {
            callback.call(element, e);
        }
    }
}

module.exports = delegate;

},{"./closest":1}],3:[function(require,module,exports){
/**
 * Check if argument is a HTML element.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.node = function(value) {
    return value !== undefined
        && value instanceof HTMLElement
        && value.nodeType === 1;
};

/**
 * Check if argument is a list of HTML elements.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.nodeList = function(value) {
    var type = Object.prototype.toString.call(value);

    return value !== undefined
        && (type === '[object NodeList]' || type === '[object HTMLCollection]')
        && ('length' in value)
        && (value.length === 0 || exports.node(value[0]));
};

/**
 * Check if argument is a string.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.string = function(value) {
    return typeof value === 'string'
        || value instanceof String;
};

/**
 * Check if argument is a function.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.fn = function(value) {
    var type = Object.prototype.toString.call(value);

    return type === '[object Function]';
};

},{}],4:[function(require,module,exports){
var is = require('./is');
var delegate = require('delegate');

/**
 * Validates all params and calls the right
 * listener function based on its target type.
 *
 * @param {String|HTMLElement|HTMLCollection|NodeList} target
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listen(target, type, callback) {
    if (!target && !type && !callback) {
        throw new Error('Missing required arguments');
    }

    if (!is.string(type)) {
        throw new TypeError('Second argument must be a String');
    }

    if (!is.fn(callback)) {
        throw new TypeError('Third argument must be a Function');
    }

    if (is.node(target)) {
        return listenNode(target, type, callback);
    }
    else if (is.nodeList(target)) {
        return listenNodeList(target, type, callback);
    }
    else if (is.string(target)) {
        return listenSelector(target, type, callback);
    }
    else {
        throw new TypeError('First argument must be a String, HTMLElement, HTMLCollection, or NodeList');
    }
}

/**
 * Adds an event listener to a HTML element
 * and returns a remove listener function.
 *
 * @param {HTMLElement} node
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNode(node, type, callback) {
    node.addEventListener(type, callback);

    return {
        destroy: function() {
            node.removeEventListener(type, callback);
        }
    }
}

/**
 * Add an event listener to a list of HTML elements
 * and returns a remove listener function.
 *
 * @param {NodeList|HTMLCollection} nodeList
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNodeList(nodeList, type, callback) {
    Array.prototype.forEach.call(nodeList, function(node) {
        node.addEventListener(type, callback);
    });

    return {
        destroy: function() {
            Array.prototype.forEach.call(nodeList, function(node) {
                node.removeEventListener(type, callback);
            });
        }
    }
}

/**
 * Add an event listener to a selector
 * and returns a remove listener function.
 *
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenSelector(selector, type, callback) {
    return delegate(document.body, selector, type, callback);
}

module.exports = listen;

},{"./is":3,"delegate":2}],5:[function(require,module,exports){
function select(element) {
    var selectedText;

    if (element.nodeName === 'SELECT') {
        element.focus();

        selectedText = element.value;
    }
    else if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        var isReadOnly = element.hasAttribute('readonly');

        if (!isReadOnly) {
            element.setAttribute('readonly', '');
        }

        element.select();
        element.setSelectionRange(0, element.value.length);

        if (!isReadOnly) {
            element.removeAttribute('readonly');
        }

        selectedText = element.value;
    }
    else {
        if (element.hasAttribute('contenteditable')) {
            element.focus();
        }

        var selection = window.getSelection();
        var range = document.createRange();

        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        selectedText = selection.toString();
    }

    return selectedText;
}

module.exports = select;

},{}],6:[function(require,module,exports){
function E () {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}],7:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'select'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('select'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.select);
        global.clipboardAction = mod.exports;
    }
})(this, function (module, _select) {
    'use strict';

    var _select2 = _interopRequireDefault(_select);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    var ClipboardAction = function () {
        /**
         * @param {Object} options
         */
        function ClipboardAction(options) {
            _classCallCheck(this, ClipboardAction);

            this.resolveOptions(options);
            this.initSelection();
        }

        /**
         * Defines base properties passed from constructor.
         * @param {Object} options
         */


        _createClass(ClipboardAction, [{
            key: 'resolveOptions',
            value: function resolveOptions() {
                var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

                this.action = options.action;
                this.container = options.container;
                this.emitter = options.emitter;
                this.target = options.target;
                this.text = options.text;
                this.trigger = options.trigger;

                this.selectedText = '';
            }
        }, {
            key: 'initSelection',
            value: function initSelection() {
                if (this.text) {
                    this.selectFake();
                } else if (this.target) {
                    this.selectTarget();
                }
            }
        }, {
            key: 'selectFake',
            value: function selectFake() {
                var _this = this;

                var isRTL = document.documentElement.getAttribute('dir') == 'rtl';

                this.removeFake();

                this.fakeHandlerCallback = function () {
                    return _this.removeFake();
                };
                this.fakeHandler = this.container.addEventListener('click', this.fakeHandlerCallback) || true;

                this.fakeElem = document.createElement('textarea');
                // Prevent zooming on iOS
                this.fakeElem.style.fontSize = '12pt';
                // Reset box model
                this.fakeElem.style.border = '0';
                this.fakeElem.style.padding = '0';
                this.fakeElem.style.margin = '0';
                // Move element out of screen horizontally
                this.fakeElem.style.position = 'absolute';
                this.fakeElem.style[isRTL ? 'right' : 'left'] = '-9999px';
                // Move element to the same position vertically
                var yPosition = window.pageYOffset || document.documentElement.scrollTop;
                this.fakeElem.style.top = yPosition + 'px';

                this.fakeElem.setAttribute('readonly', '');
                this.fakeElem.value = this.text;

                this.container.appendChild(this.fakeElem);

                this.selectedText = (0, _select2.default)(this.fakeElem);
                this.copyText();
            }
        }, {
            key: 'removeFake',
            value: function removeFake() {
                if (this.fakeHandler) {
                    this.container.removeEventListener('click', this.fakeHandlerCallback);
                    this.fakeHandler = null;
                    this.fakeHandlerCallback = null;
                }

                if (this.fakeElem) {
                    this.container.removeChild(this.fakeElem);
                    this.fakeElem = null;
                }
            }
        }, {
            key: 'selectTarget',
            value: function selectTarget() {
                this.selectedText = (0, _select2.default)(this.target);
                this.copyText();
            }
        }, {
            key: 'copyText',
            value: function copyText() {
                var succeeded = void 0;

                try {
                    succeeded = document.execCommand(this.action);
                } catch (err) {
                    succeeded = false;
                }

                this.handleResult(succeeded);
            }
        }, {
            key: 'handleResult',
            value: function handleResult(succeeded) {
                this.emitter.emit(succeeded ? 'success' : 'error', {
                    action: this.action,
                    text: this.selectedText,
                    trigger: this.trigger,
                    clearSelection: this.clearSelection.bind(this)
                });
            }
        }, {
            key: 'clearSelection',
            value: function clearSelection() {
                if (this.trigger) {
                    this.trigger.focus();
                }

                window.getSelection().removeAllRanges();
            }
        }, {
            key: 'destroy',
            value: function destroy() {
                this.removeFake();
            }
        }, {
            key: 'action',
            set: function set() {
                var action = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'copy';

                this._action = action;

                if (this._action !== 'copy' && this._action !== 'cut') {
                    throw new Error('Invalid "action" value, use either "copy" or "cut"');
                }
            },
            get: function get() {
                return this._action;
            }
        }, {
            key: 'target',
            set: function set(target) {
                if (target !== undefined) {
                    if (target && (typeof target === 'undefined' ? 'undefined' : _typeof(target)) === 'object' && target.nodeType === 1) {
                        if (this.action === 'copy' && target.hasAttribute('disabled')) {
                            throw new Error('Invalid "target" attribute. Please use "readonly" instead of "disabled" attribute');
                        }

                        if (this.action === 'cut' && (target.hasAttribute('readonly') || target.hasAttribute('disabled'))) {
                            throw new Error('Invalid "target" attribute. You can\'t cut text from elements with "readonly" or "disabled" attributes');
                        }

                        this._target = target;
                    } else {
                        throw new Error('Invalid "target" value, use a valid Element');
                    }
                }
            },
            get: function get() {
                return this._target;
            }
        }]);

        return ClipboardAction;
    }();

    module.exports = ClipboardAction;
});

},{"select":5}],8:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './clipboard-action', 'tiny-emitter', 'good-listener'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./clipboard-action'), require('tiny-emitter'), require('good-listener'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.clipboardAction, global.tinyEmitter, global.goodListener);
        global.clipboard = mod.exports;
    }
})(this, function (module, _clipboardAction, _tinyEmitter, _goodListener) {
    'use strict';

    var _clipboardAction2 = _interopRequireDefault(_clipboardAction);

    var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

    var _goodListener2 = _interopRequireDefault(_goodListener);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    var Clipboard = function (_Emitter) {
        _inherits(Clipboard, _Emitter);

        /**
         * @param {String|HTMLElement|HTMLCollection|NodeList} trigger
         * @param {Object} options
         */
        function Clipboard(trigger, options) {
            _classCallCheck(this, Clipboard);

            var _this = _possibleConstructorReturn(this, (Clipboard.__proto__ || Object.getPrototypeOf(Clipboard)).call(this));

            _this.resolveOptions(options);
            _this.listenClick(trigger);
            return _this;
        }

        /**
         * Defines if attributes would be resolved using internal setter functions
         * or custom functions that were passed in the constructor.
         * @param {Object} options
         */


        _createClass(Clipboard, [{
            key: 'resolveOptions',
            value: function resolveOptions() {
                var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

                this.action = typeof options.action === 'function' ? options.action : this.defaultAction;
                this.target = typeof options.target === 'function' ? options.target : this.defaultTarget;
                this.text = typeof options.text === 'function' ? options.text : this.defaultText;
                this.container = _typeof(options.container) === 'object' ? options.container : document.body;
            }
        }, {
            key: 'listenClick',
            value: function listenClick(trigger) {
                var _this2 = this;

                this.listener = (0, _goodListener2.default)(trigger, 'click', function (e) {
                    return _this2.onClick(e);
                });
            }
        }, {
            key: 'onClick',
            value: function onClick(e) {
                var trigger = e.delegateTarget || e.currentTarget;

                if (this.clipboardAction) {
                    this.clipboardAction = null;
                }

                this.clipboardAction = new _clipboardAction2.default({
                    action: this.action(trigger),
                    target: this.target(trigger),
                    text: this.text(trigger),
                    container: this.container,
                    trigger: trigger,
                    emitter: this
                });
            }
        }, {
            key: 'defaultAction',
            value: function defaultAction(trigger) {
                return getAttributeValue('action', trigger);
            }
        }, {
            key: 'defaultTarget',
            value: function defaultTarget(trigger) {
                var selector = getAttributeValue('target', trigger);

                if (selector) {
                    return document.querySelector(selector);
                }
            }
        }, {
            key: 'defaultText',
            value: function defaultText(trigger) {
                return getAttributeValue('text', trigger);
            }
        }, {
            key: 'destroy',
            value: function destroy() {
                this.listener.destroy();

                if (this.clipboardAction) {
                    this.clipboardAction.destroy();
                    this.clipboardAction = null;
                }
            }
        }], [{
            key: 'isSupported',
            value: function isSupported() {
                var action = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ['copy', 'cut'];

                var actions = typeof action === 'string' ? [action] : action;
                var support = !!document.queryCommandSupported;

                actions.forEach(function (action) {
                    support = support && !!document.queryCommandSupported(action);
                });

                return support;
            }
        }]);

        return Clipboard;
    }(_tinyEmitter2.default);

    /**
     * Helper function to retrieve attribute value.
     * @param {String} suffix
     * @param {Element} element
     */
    function getAttributeValue(suffix, element) {
        var attribute = 'data-clipboard-' + suffix;

        if (!element.hasAttribute(attribute)) {
            return;
        }

        return element.getAttribute(attribute);
    }

    module.exports = Clipboard;
});

},{"./clipboard-action":7,"good-listener":4,"tiny-emitter":6}]},{},[8])(8)
});
/**
@module mobile-angular-ui
@position 0
@description

This is the main angular module of `mobile-angular-ui` framework.

By requiring this module you will have all `mobile-angular-ui.core`
and `mobile-angular-ui.components` features required as well. 

## Usage

Declare it as a dependency for your application:

``` js
angular.module('myApp', ['mobile-angular-ui']);
```

*/
(function() {
  'use strict';

  angular.module('mobile-angular-ui', [
    'mobile-angular-ui.core',
    'mobile-angular-ui.components'
  ]);

}());