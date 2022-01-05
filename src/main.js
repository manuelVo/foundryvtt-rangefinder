import {libWrapper} from "./libwrapper_shim.js";

Hooks.once("init", () => {
	registerSettings()
	hookFunctions()
	window.addEventListener("mousemove", onMouseMove)
})

function registerSettings() {
	game.settings.register("rangefinder", "activationKey", {
		name: "rangefinder.activationKey.name",
		hint: "rangefinder.activationKey.hint",
		scope: "client",
		config: true,
		type: String,
		default: "AltRight",
	})
}

function hookFunctions() {
	libWrapper.register("rangefinder", "KeyboardManager.prototype._handleKeys", handleKeys, "WRAPPER");
	libWrapper.register("rangefinder", "Ruler.prototype._onClickRight", onClickRight, "MIXED");
	libWrapper.register("rangefinder", "Canvas.prototype._onClickLeft", onClickLeft, "MIXED");
	libWrapper.register("rangefinder", "Ruler.prototype._onMouseUp", onMouseUp, "MIXED");
}

function getControlledToken() {
	const controlled = canvas.tokens.controlled
	switch (controlled.length) {
		case 0:
			// If no token is selected use the token of the users character
			return canvas.tokens.placeables.find(token => token.actor.data._id === game.user.character?.data?._id)
		case 1:
			// If exactly one token is selected, take that
			return controlled[0]
		default:
			// Do nothing if multiple tokens are selected
			return undefined
	}
}

function handleKeys(wrapped, event, key, up) {
	if (!event.repeat && event.code.toLowerCase() === game.settings.get("rangefinder", "activationKey").toLowerCase()) {
		const ruler = canvas.controls.ruler
		if (up) {
			if (ruler.isRangefinder) {
				ruler.isRangefinder = false
				if (ruler._state !== Ruler.STATES.MOVING)
					ruler._endMeasurement()
			}
		}
		else {
			// If the current ruler is a rangefinder don't refresh it
			// This can happen because the browser may fire another event that doesn't have event.repeat set after a click on the canvas
			if (ruler.isRangefinder)
				return;
			const token = getControlledToken()
			if (!token)
				return
			ruler.clear()
			ruler.isRangefinder = true
			ruler.rangefinderToken = token
			const tokenCenter = {x: token.x + token.w / 2, y: token.y + token.h / 2}
			ruler._addWaypoint(tokenCenter)
			measure(event)
			game.user.broadcastActivity({ruler})
		}
	}
	return wrapped(event, key, up);
}

function onClickRight(wrapped, event) {
	if (!this.isRangefinder) {
		wrapped(event);
	}
	// Don't allow to remove the last waypoint from a rangefinder
	else if ((this._state === 2) && (this.waypoints.length > 1)) {
		this._removeWaypoint(event.data.origin, {snap: !event.data.originalEvent.shiftKey})
	}
}

function onClickLeft(wrapped, event) {
	const ruler = this.controls.ruler;
	if (ruler.isRangefinder)
		ruler._addWaypoint(event.data.origin);
	else
		wrapped(event);
}

function onMouseUp(wrapped, event) {
	if (!this.isRangefinder)
		wrapped(event);
}

function onMouseMove(event) {
	const ruler = canvas?.controls?.ruler
	if (!ruler)
		return
	if (ruler.isRangefinder) {
		if (ruler._state === Ruler.STATES.MOVING)
			return
		measure(event)
	}
}

function measure(event) {
	const ruler = canvas.controls.ruler
	const canvasMousePos = canvas.app.renderer.plugins.interaction.mouse.getLocalPosition(canvas.tokens)

	const mt = ruler.rangefinderMeasureTime ?? 0

	// Hide any existing Token HUD
	canvas.hud.token.clear();

	// Draw measurement updates
	if ( Date.now() - mt > 50 ) {
	  ruler.measure(canvasMousePos, {gridSpaces: !event.shiftKey});
	  ruler.rangefinderMeasureTime = Date.now();
	  ruler._state = Ruler.STATES.MEASURING;
	}
}
