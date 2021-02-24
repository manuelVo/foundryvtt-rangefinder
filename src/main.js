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
	const originalHandleKeys = KeyboardManager.prototype._handleKeys
	KeyboardManager.prototype._handleKeys = function (event, key, up) {
		handleKeys.call(this, event, key, up)
		return originalHandleKeys.call(this, event, key, up)
	}

	const originalOnClickRight = Ruler.prototype._onClickRight
	Ruler.prototype._onClickRight = function (event) {
		if (!this.isRangefinder) {
			originalOnClickRight.call(this, event)
		}
		// Don't allow to remove the last waypoint from a rangefinder
		else if ((this._state === 2) && (this.waypoints.length > 1)) {
			this._removeWaypoint(event.data.origin, {snap: !event.data.originalEvent.shiftKey})
		}
	}

	const originalOnClickLeft = Canvas.prototype._onClickLeft
	Canvas.prototype._onClickLeft = function (event) {
		const ruler = this.controls.ruler
		if (ruler.isRangefinder)
			ruler._addWaypoint(event.data.origin)
		else
			originalOnClickLeft.call(this, event)
	}

	const originalOnMouseUp = Ruler.prototype._onMouseUp
	Ruler.prototype._onMouseUp = function(event) {
		if (!this.isRangefinder)
			originalOnMouseUp.call(this, event)
	}
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

function handleKeys(event, key, up) {
	if (event.repeat)
		return
	if (event.code.toLowerCase() === game.settings.get("rangefinder", "activationKey").toLowerCase()) {
		const ruler = canvas.controls.ruler
		if (up) {
			if (ruler.isRangefinder) {
				ruler.isRangefinder = false
				if (ruler._state !== Ruler.STATES.MOVING)
					ruler._endMeasurement()
			}
		}
		else {
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
