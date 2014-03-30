"use strict";

var EXPORTED_SYMBOLS = ["SSleuthUI"] 

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://ssleuth/utils.js");
Components.utils.import("resource://ssleuth/cipher-suites.js");
Components.utils.import("resource://ssleuth/preferences.js");

var SSleuthUI = {
	ssleuthLoc : { URLBAR: 0, TOOLBAR: 1 },
	ssleuthBtnLocation : null, 
	prefs: null, 
	prefsRegistered: false, 
	panelMenuTemplate: null, 

	init: function(window) {
		dump ("\nssleuth UI init : \n");
		try {
			window.document.loadOverlay("chrome://ssleuth/content/ssleuth.xul", 
					{observe: function(subject, topic, data) {
						if (topic == "xul-overlay-merged") {
							// dump("\nXUL overlay merged! \n"); 
							/* TODO : Keep an eye on this 'window' element!*/
							try {
								SSleuthUI.initUI(window); 
							} catch (e) {
								dump("SSLeuthUI init Error : " + e.message + "\n"); 
								/* FIXME : window is null during an error */
								SSleuthUI.uninit(_window());
							}
						}
					}});
		} catch (e) {
			dump("Failed overlay load : " + e.message + "\n"); 
		}
	},

	initUI: function(window) {
		// Verify if things are in good shape! 
		if (window.document.getElementById("ssleuth-panel-vbox")) {
			dump("initUI : panel elems available!\n"); 
		} else {
			this.uninit(); 
		}
		this.prefs = SSleuthPreferences.readInitPreferences(); 
		if (!this.prefsRegistered) {
				prefListener.register(false); 
				this.prefRegistered = true; 	
		}

		
		this.ssleuthBtnLocation = this.prefs.PREFS["notifier.location"]; 
		var ssleuthButton = createButton(window); 
		installButton(ssleuthButton,
						true, 
						window.document); 

		createPanelMenu(window.document); 

		createKeyShortcut(window.document);
		loadStyleSheet(); 
		
		var ssleuthPanel = _ssleuthPanel(window); 
		if (ssleuthPanel == null) {
			dump("\n UI initUI ssleuthPanel is null! \n"); 
		}
		var panelVbox = window.document.getElementById("ssleuth-panel-vbox"); 
		ssleuthPanel.appendChild(panelVbox); 
		setPanelFont(this.prefs.PREFS["panel.fontsize"], window.document); 
	}, 

	uninit: function(window) {
		dump("\n SSleuth UI  : uninit \n"); 
		// Cleanup everything! 
		// Removing the button deletes the overlay elements as well 
		try {
		prefListener.unregister(); 
		removePanelMenu(window.document); 
		removeButton(_ssleuthButton(window)); 

		deleteKeyShortcut(window.document); 
		removeStyleSheet(); 

		// A preference tab is open ?
		} catch (e) { dump("Error uninit : " + e.message + "\n"); }
	},

	onLocationChange: function(window) {
		// The document elements are not available until a 
		// successful init. So we need to add the child panel
		// for the first time 
		try {
				if (window == null ) {
					dump("\n UI onLocationchange window is null! \n"); 
					return; 
				}
			} catch (e) {
			dump("Error onlocation change ssleuthpanel child : " + e.message + "\n"); 
		}

		// If the user navigates the tabs with the panel open, 
		//  make it appear smooth. 
		var ssleuthPanel = _ssleuthPanel(window);
		if (ssleuthPanel.state == "open") {
			showPanel(ssleuthPanel, true); 
		}
	},

	protocolChange: function(proto, data) {
		switch(proto) {
			case "unknown":
				setButtonRank(-1);
				setBoxHidden("https", true);
				setBoxHidden("http", true); 
				break;
			case "http":
				setButtonRank(-1);
				setBoxHidden("https", true);
				setBoxHidden("http", false);
				setHttpsLink(data);
				break;
			case "https":
				setBoxHidden("https", false);
				setBoxHidden("http", true);
				break;
		}
	},

	fillPanel: function(connectionRank,
				cipherSuite,
				securityState,
				cert,
				certValid,
				domMismatch,
				ev,
				ratingParams) {
		setButtonRank(connectionRank); 
		panelConnectionRank(connectionRank); 

		showCipherDetails(cipherSuite, ratingParams); 
		showPFS(cipherSuite.pfs, ratingParams); 
		showFFState(securityState, ratingParams); 
		showCertDetails(cert, certValid, domMismatch, ev, ratingParams); 
	}

};

/* The problem with the window element : 
 * 	- The below query is not possible until the init
 * 	is complete. Hence any call to _window() during an init() 
 * 	will return	garbage.
 * 	- After init(), while switching between windows, it 
 * 	is necessary to get the current active window.
 */
function _window() {
	return Services.wm.getMostRecentWindow("navigator:browser");
}

function _ssleuthButton(window) {
	const ui = SSleuthUI; 
	const win = window; 
	if (ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR) {
		return win.document.getElementById("ssleuth-tb-button");
	} else if (ui.ssleuthBtnLocation == ui.ssleuthLoc.URLBAR) {
		return win.document.getElementById("ssleuth-box-urlbar");
	}
}

function _ssleuthBtnImg() {
	const ui = SSleuthUI; 
	const win = _window(); 
	if (ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR) {
		return win.document.getElementById("ssleuth-tb-button");
	} else if (ui.ssleuthBtnLocation == ui.ssleuthLoc.URLBAR) {
		return win.document.getElementById("ssleuth-ub-img");
	}
}

function _ssleuthPanel(window) {
	return window.document.getElementById("ssleuth-panel");
}

function loadStyleSheet() {
	var sss = Cc["@mozilla.org/content/style-sheet-service;1"]
				.getService(Components.interfaces.nsIStyleSheetService);
	var ios = Cc["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
	var uri = ios.newURI("chrome://ssleuth/skin/ssleuth.css", null, null);
	if(!sss.sheetRegistered(uri, sss.USER_SHEET))
		sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
}

function removeStyleSheet() {
	var sss = Cc["@mozilla.org/content/style-sheet-service;1"]
				.getService(Components.interfaces.nsIStyleSheetService);
	var ios = Cc["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
	var uri = ios.newURI("chrome://ssleuth/skin/ssleuth.css", null, null);
	if(sss.sheetRegistered(uri, sss.USER_SHEET))
		sss.unregisterSheet(uri, sss.USER_SHEET);
}

function createPanel(panelId, position, window) {
	dump ("\n createPanel ** \n"); 
	const doc = window.document; 
	try {
		var panel = doc.createElement("panel"); 
		panel.setAttribute("id", panelId); 
		panel.setAttribute("position", position); 
		panel.setAttribute("type", "arrow"); 
	} catch (e) {
		dump("\nError creating panel : " + e.message + "\n"); 
	}
	return panel;
}

function installButton(ssleuthButton, firstRun, document) {
	try {
		const ui = SSleuthUI; 
		if (ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR) {
			// The whole thing helps in remembering the toolbar button location?
			//
			var toolbar = document.getElementById("nav-bar");
			var toolbarButton = ssleuthButton; 
			var buttonId = "ssleuth-tb-button"; 

			var palette = document.getElementById("navigator-toolbox").palette;
			palette.appendChild(toolbarButton);
			var currentset = toolbar.getAttribute("currentset").split(",");
			var index = currentset.indexOf(buttonId);
			dump ("Index : " + index + "\n"); 
			if (index == -1) {
				if (firstRun) {
				// No button yet so add it to the toolbar.
					toolbar.appendChild(toolbarButton);
					toolbar.setAttribute("currentset", toolbar.currentSet);
					document.persist(toolbar.id, "currentset");
				}
			} else {
				// The ID is in the currentset, so find the position and
				// insert the button there.
				var before = null;
				for (var i=index+1; i<currentset.length; i++) {
					before = document.getElementById(currentset[i]);
					if (before) {
						toolbar.insertItem(buttonId, before);
						break;
					}
				}
				if (!before) {
					toolbar.insertItem(buttonId);
				}
			}
		} else if (ui.ssleuthBtnLocation == ui.ssleuthLoc.URLBAR) {
			var urlbar = document.getElementById("urlbar"); 		
			urlbar.insertBefore(ssleuthButton, 
				document.getElementById("identity-box")); 

		} else {
			dump("ssleuthBtnLocation undefined! \n"); 
		}
	} catch(ex) {
		dump ("\n Failed install button : " + ex.message + "\n"); 
	}
}

function createButton(window) {
	try {
		const document = window.document; 
		const ui = SSleuthUI; 
		var button; 
		var panelPosition; 

		if (ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR) {
			button = document.createElement("toolbarbutton");
			button.setAttribute("id", "ssleuth-tb-button");
			button.setAttribute("removable", "true");
			button.setAttribute("class",
				"toolbarbutton-1 chromeclass-toolbar-additional");
			button.setAttribute("type", "panel");
			panelPosition = "bottomcenter topright"; 
			// For a toolbar button, images can be set directly.
			button.setAttribute("rank", "default"); 

		} else if (ui.ssleuthBtnLocation == ui.ssleuthLoc.URLBAR) {
			button = document.createElement("box");
			button.setAttribute("id", "ssleuth-box-urlbar");
			button.setAttribute("role", "button"); 
			button.setAttribute("align", "center"); 
			button.setAttribute("width", "40"); 

			var img = document.createElement("image"); 
			img.setAttribute("id", "ssleuth-ub-img"); 
			img.setAttribute("rank", "default"); 
			button.appendChild(img); 

			panelPosition = "bottomcenter topleft"; 
		}

		button.setAttribute("label", "SSleuth");
		button.addEventListener("contextmenu", menuEvent, false); 
		// button.setAttribute("oncommand", "null"); 
		button.addEventListener("click", panelEvent, false); 
		button.addEventListener("keypress", panelEvent, false);

		button.appendChild(createPanel("ssleuth-panel", 
			panelPosition, window) ); 

		if (ui.ssleuthBtnLocation == ui.ssleuthLoc.URLBAR) {
			var desc = document.createElement("description"); 
			desc.setAttribute("id", "ssleuth-ub-rank"); 
			desc.setAttribute("class", "plain ssleuth-text-body-class"); 
			// For some strange reason, the below one doesn't work from
			// 	the style sheet! 
			desc.setAttribute("style", "padding-left: 4px; padding-right: 2px;"); 
			button.appendChild(desc); 
		}

	} catch (ex) {
		dump("\n Failed create button : " + ex.message + "\n"); 
	}
	return button; 
}

function removeButton(button) {
	dump("\n Remove button \n"); 
	try {
		button.parentElement.removeChild(button); 
	} catch (ex) {
		dump("\n Failed remove button : " + ex.message + "\n"); 
	}
}

function panelEvent(event) {
	dump("\n XUL Panel Event : " + event.type + "\n"); 
	if (event.type == "click" && event.button == 2) {
		/* ssleuth.openPreferences(); */
	} else {
		// The toolbar button, technically being a 'button'
		// and the panel as it's child, is automagically opened by firefox.
		// Unlike a shortcut-key or the urlbar notifier, we don't
		// need to open the panel in this case. 
		try {
			dump ("Panel state : " + _ssleuthPanel(_window()).state + "\n"); 
			const ui = SSleuthUI; 
			if (!(event.type == "click" && 
					event.button == 0 &&
					ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR )) { 
				togglePanel(_ssleuthPanel(_window())); 
			}
	 	} catch(ex) {
			dump("Error while panelEvent action : " + ex.message + "\n"); 
		}
	}
}

function setHttpsLink(url) {
	var doc = _window().document; 
	var panelLink = doc.getElementById("ssleuth-panel-https-link"); 

	panelLink.href = url; 
	panelLink.value = url; 
}

function setBoxHidden(protocol, show) {
	var doc = _window().document; 

	switch (protocol) {
		case "http" : 
			doc.getElementById('ssleuth-panel-vbox-http').hidden = show; 
			break;
		 case "https" : 
			doc.getElementById('ssleuth-panel-vbox-https').hidden = show; 
			break; 
		 default :
			dump("\n Unknown container \n"); 
	}
}

function showPanel(panel, show) {
	if (show) {
		panel.openPopup(_ssleuthButton(_window())); 
	} else {
		panel.hidePopup(); 
	}
}

function togglePanel(panel) {
	if (panel.state == "closed") {
		showPanel(panel, true); 
	} else if (panel.state == "open") {
		showPanel(panel, false); 
	}
}

function panelConnectionRank(rank) {
	var s = []; 
	var doc = _window().document; 

	// I don't see any easy CSS hacks
	// without having to autogenerate spans in html.
	for (var i=1; i<=10; i++) {
		s[i] = doc.getElementById("ssleuth-img-cipher-rank-star-" + String(i)); 
		s[i].className = "ssleuth-star";
	}

	for (var i=1; i<=10; i++) {
		if (i <= rank) {
			s[i].className = "ssleuth-star-full";  
			if (i == rank) 
				break; 
		} 
		if ((i < rank) && (i+1 > rank)) {
			s[i+1].className = "ssleuth-star-half"; 
			break; 
		}
	}
	doc.getElementById("ssleuth-text-cipher-rank-numeric").textContent = (rank + "/10"); 
}

function setButtonRank(connectionRank) {
	var buttonRank = "default"; 
	var doc = _window().document; 
	
	if (connectionRank <= -1 ) {
		buttonRank = "default"; 
	} else if (connectionRank < 5) {
	   buttonRank = "low";
	} else if (connectionRank < 7) {
		buttonRank = "medium"; 
	} else if (connectionRank < 9) {
		buttonRank = "high"; 
	} else if (connectionRank <= 10) {
		buttonRank = "vhigh"; 
	}

	_ssleuthBtnImg().setAttribute("rank", buttonRank); 

	if (SSleuthUI.ssleuthBtnLocation == SSleuthUI.ssleuthLoc.URLBAR) {
		var ssleuthUbRank = doc.getElementById("ssleuth-ub-rank");  

		ssleuthUbRank.setAttribute("rank", buttonRank);
		if (connectionRank != -1) {
			ssleuthUbRank.textContent = String(Number(connectionRank).toFixed(1)); 
		} else {
			ssleuthUbRank.textContent = ""; 
		}
		_ssleuthButton(_window()).setAttribute("rank", buttonRank); 
	} 
}

function showCipherDetails(cipherSuite, rp) {
	var doc = _window().document; 
	const cs = ssleuthCipherSuites; 
	var marginCipherStatus = "low"; 
	if (cipherSuite.rank >= cs.cipherSuiteStrength.HIGH) {
		marginCipherStatus = "high"; 
	} else if (cipherSuite.rank > cs.cipherSuiteStrength.MEDIUM) {
		marginCipherStatus = "med"; 
	}

	doc.getElementById("ssleuth-img-cipher-rank")
		.setAttribute("status", marginCipherStatus); 

	doc.getElementById("ssleuth-text-cipher-suite").textContent = 
		(cipherSuite.name); 

	var rating = Number(cipherSuite.rank * rp.cipherSuite/10).toFixed(1);
	doc.getElementById("ssleuth-cipher-suite-rating").textContent =
		(rating + "/" + rp.cipherSuite); 

	doc.getElementById("ssleuth-text-cipher-suite-kxchange").textContent = 
		(cipherSuite.keyExchange.ui); 
	doc.getElementById("ssleuth-text-cipher-suite-auth").textContent = 
		(cipherSuite.authentication.ui + "."); 

	// Need to localize 'bits'. XUL - may not need ids. 
	doc.getElementById("ssleuth-text-cipher-suite-auth-key").textContent =
		(cipherSuite.signatureKeyLen + " bits."); 
	doc.getElementById("ssleuth-text-cipher-suite-bulkcipher").textContent = 
		(cipherSuite.bulkCipher.ui + " " + cipherSuite.cipherKeyLen 
			+ " bits.");
	doc.getElementById("ssleuth-text-cipher-suite-bulkcipher-notes").textContent =
		 cipherSuite.bulkCipher.notes; 
	doc.getElementById("ssleuth-text-cipher-suite-hmac").textContent = 
		(cipherSuite.HMAC.ui + ".");
	doc.getElementById("ssleuth-text-cipher-suite-hmac-notes").textContent = 
		cipherSuite.HMAC.notes; 

	const panelInfo = SSleuthUI.prefs.PREFS["panel.info"]; 
	doc.getElementById("ssleuth-text-authentication").hidden 
		= !(panelInfo.authAlg); 
	doc.getElementById("ssleuth-text-bulk-cipher").hidden
		= !(panelInfo.bulkCipher); 
	doc.getElementById("ssleuth-text-hmac").hidden
		= !(panelInfo.HMAC); 
	doc.getElementById("ssleuth-text-key-exchange").hidden
		= !(panelInfo.keyExchange); 
}

function showPFS(pfs, rp) {
	var doc = _window().document; 

	const pfsImg = doc.getElementById("ssleuth-img-p-f-secrecy"); 
	const pfsTxt = doc.getElementById("ssleuth-text-p-f-secrecy"); 
	const pfsRating = doc.getElementById("ssleuth-p-f-secrecy-rating"); 

	var rating = Number(pfs * rp.pfs).toFixed(1);
	pfsRating.textContent = rating + "/" + rp.pfs; 

	// pfsImg.setAttribute("hidden", "false"); 
	if (pfs) {
		pfsImg.setAttribute("status", "yes"); 
		pfsTxt.textContent = "Perfect Forward Secrecy : Yes";
	} else {
		pfsImg.setAttribute("status", "no"); 
		pfsTxt.textContent = "Perfect Forward Secrecy : No";
	}
}

function showFFState(state, rp) {
	var doc = _window().document; 

	doc.getElementById("ssleuth-img-ff-connection-status").setAttribute("state", state); 
	doc.getElementById("ssleuth-text-ff-connection-status").textContent = state; 
	const statusRating = doc.getElementById("ssleuth-ff-connection-status-rating");
	var brokenText = doc.getElementById("ssleuth-text-ff-connection-status-broken");

	var rating = Number(((state == "Secure") ? 1 : 0) * rp.ffStatus).toFixed(1);
	statusRating.textContent = rating + "/" + rp.ffStatus; 

	if ( state == "Broken" || state == "Insecure") {
		brokenText.setAttribute("hidden", "false"); 
	} else {
		brokenText.setAttribute("hidden", "true"); 
	}
}

function showCertDetails(cert, certValid, domMismatch, ev, rp) {
	var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
	var doc = _window().document; 

	const panelInfo = SSleuthUI.prefs.PREFS["panel.info"]; 
	doc.getElementById("ssleuth-text-cert-common-name").textContent = cert.commonName; 
	var certRating = doc.getElementById("ssleuth-cert-status-rating"); 
	var evRating = doc.getElementById("ssleuth-cert-ev-rating"); 
	var elemEV = doc.getElementById("ssleuth-text-cert-extended-validation"); 
	var evText = (ev)? "Yes" : "No"; 
	elemEV.textContent = evText; 
	elemEV.setAttribute("ev", evText); 

	var rating = (Number(ev) * rp.evCert).toFixed(1);
	evRating.textContent = rating + "/" + rp.evCert; 

	toggleCertElem("ssleuth-text-cert-org", cert.organization); 
	toggleCertElem("ssleuth-text-cert-org-unit", cert.organizationalUnit); 
	toggleCertElem("ssleuth-text-cert-issuer-org", cert.issuerOrganization); 
	toggleCertElem("ssleuth-text-cert-issuer-org-unit", 
			cert.issuerOrganizationUnit); 

	function toggleCertElem(id, text) {
		var elem = doc.getElementById(id); 
		elem.textContent = text; 
		elem.hidden = (text == "");
	}

	var certValidity = doc.getElementById("ssleuth-text-cert-validity"); 
	certValidity.setAttribute("valid", certValid.toString()); 

	if (panelInfo.validityTime) 
		certValidity.textContent = validity.notBeforeGMT + " till " + validity.notAfterGMT;
	else 
		certValidity.textContent = validity.notBeforeLocalDay + " till " + validity.notAfterLocalDay;

	doc.getElementById("ssleuth-text-cert-domain-mismatch").hidden = !domMismatch;

	var rating = (Number(certValid && !domMismatch) * rp.certStatus).toFixed(1);
	certRating.textContent = rating + "/" + rp.certStatus; 

	if (certValid && !domMismatch) {
		doc.getElementById("ssleuth-img-cert-state").setAttribute("state", "good"); 
	} else {
		doc.getElementById("ssleuth-img-cert-state").setAttribute("state", "bad"); 
	}

	doc.getElementById("ssleuth-text-cert-fingerprint")
		.textContent = cert.sha1Fingerprint; 

	doc.getElementById("ssleuth-text-cert-validity-box").hidden 
		= !(panelInfo.certValidity); 
	doc.getElementById("ssleuth-text-cert-fingerprint").hidden 
		= !(panelInfo.certFingerprint); 
}
	 
function createKeyShortcut(doc) {
	var keyset = doc.createElement("keyset"); 	
	var key = doc.createElement("key"); 
	const shortcut = 
		SSleuthUI.prefs.PREFS["ui.keyshortcut"]; 

	key.setAttribute("id", "ssleuth-panel-keybinding"); 
	key.addEventListener("command", panelEvent);
	// Mozilla, I have no clue, without pointing 'oncommand' to
	// something, the key events won't fire! I already have an 
	// event listener for 'command'.
	key.setAttribute("oncommand", "void(0);");

	var keys = shortcut.split(" ");
	var len = keys.length; 
	key.setAttribute("key", keys.splice(len-1, 1)); 
	key.setAttribute("modifiers", keys.join(" ")); 

	keyset.appendChild(key); 
	doc.documentElement.appendChild(keyset);
}

function deleteKeyShortcut(doc) {
	var keyset = doc.getElementById("ssleuth-panel-keybinding").parentElement; 
	keyset.parentElement.removeChild(keyset); 
}

function readUIPreferences() {
	const prefs = SSleuthPreferences.prefService; 
	SSleuthUI.ssleuthBtnLocation = 
		prefs.getIntPref("extensions.ssleuth.notifier.location"); 
}

function setPanelFont(panelFont, doc) {
	var bodyFontClass = "ssleuth-text-body-class";
	var titleFontClass = "ssleuth-text-title-class";
	var imgStateClass = "ssleuth-img-state"; 

	// 0 = default, 1 = medium, 2 = large
	var configBody = ["ssleuth-text-body-small", "ssleuth-text-body-medium",
					"ssleuth-text-body-large"];
	var configTitle = ["ssleuth-text-title-small", "ssleuth-text-title-medium",
					"ssleuth-text-title-large"];
	var configImg = ["ssleuth-img-state-small", "ssleuth-img-state-medium", 
					"ssleuth-img-state-large"]; 
	try {
		var bodyText = doc.getElementsByClassName(bodyFontClass); 
		var titleText = doc.getElementsByClassName(titleFontClass); 
		var stateImg = doc.getElementsByClassName(imgStateClass);

		for (var i = 0; i < bodyText.length; i++) {
			bodyText[i].className = bodyFontClass + " " + configBody[panelFont];
		}
		for (var i = 0; i < titleText.length; i++) {
			titleText[i].className = titleFontClass + " " + configTitle[panelFont]; 
		}
		for (var i=0; i<stateImg.length; i++) {
			stateImg[i].className = imgStateClass + " " +
										configImg[panelFont]; 
		}

		// Exception case : urlbar button text also changes with 
		// panel body. In addition, it requires a 'plain' class. 
		// A better way to handle this case? 
		var ubRank = doc.getElementById("ssleuth-ub-rank"); 
		if (ubRank) 
			ubRank.className = "plain " + bodyFontClass + " " + configBody[panelFont];
	} catch(e) {
		dump("setPanelFont error : " + e.message + "\n"); 
	}
}

function menuEvent(event) {
	try {
		event.preventDefault(); 
		var doc = _window().document; 

		var ssleuthPanelMenu = doc.getElementById("ssleuth-panel-menu"); 
		var menupopup = SSleuthUI.panelMenuTemplate.cloneNode(true); 

		// TODO : Replace with a traverse, and find ssleuth-menu-cs-reset-all
		// Note that this is the cloned node, and not yet inserted into doc
		var mi = menupopup.firstChild.nextSibling.nextSibling;

		// This has to be done everytime, as the preferences change.
		var csList = JSON.parse(SSleuthPreferences.prefService
						.getCharPref("extensions.ssleuth.suites.toggle"));
		if (csList.length >0) {
			for (var i=0; i<csList.length; i++) {
				var menu = doc.createElement("menu"); 
				menu.setAttribute("label", csList[i].name);

				var m_popup = doc.createElement("menupopup"); 
				for (var rd of ["Default", "Enable", "Disable"]) {
					var m_item = doc.createElement("menuitem");
					m_item.setAttribute("type", "radio"); 
					m_item.setAttribute("label", rd);
					m_item.setAttribute("value", rd.toLowerCase());
					if (csList[i].state === rd.toLowerCase()) {
						m_item.setAttribute("checked", true); 
					}
					m_popup.appendChild(m_item); 
				}
				m_popup.addEventListener("command", function(event) {
					var m = event.currentTarget.parentNode;
					var csTglList = cloneArray(SSleuthUI.prefs.PREFS["suites.toggle"]); 
					for (var i=0; i<csTglList.length; i++) {
						if (m.label === csTglList[i].name) {
							csTglList[i].state = event.target.value; 
						}
					}
					SSleuthPreferences.prefService
						.setCharPref("extensions.ssleuth.suites.toggle", JSON.stringify(csTglList));
				}); 

				menu.appendChild(m_popup);
				menupopup.insertBefore(menu, mi); 
			}
		}

		doc.documentElement.replaceChild(menupopup, ssleuthPanelMenu); 
		// Add listeners. Since we use the id's to get the element, 
		// this can only be done after inserting the menupopup into the document. 
		for (var id of [
			"ssleuth-menu-open-preferences",
			"ssleuth-menu-open-about",
			"ssleuth-menu-cs-reset-all",
			"ssleuth-menu-cs-custom-list"
		  ]) {
			doc.getElementById(id) 
				.addEventListener("command", menuCommand, false);
		} 

		menupopup.openPopup(_ssleuthButton(_window()));
	} catch (e) {
		dump("menuEvent error : " + e.message + "\n"); 
	}
}

function menuCommand(event) {
	var doc = _window().document; 
	switch (event.target.id) {
		case 'ssleuth-menu-cs-reset-all' : 
			const prefs = SSleuthPreferences.prefService; 

            var csList = prefs.getChildList("security.ssl3.", {}); 
            for (var i=0; i<csList.length; i++) {
                prefs.clearUserPref(csList[i]); 
            }

			var csTglList = cloneArray(SSleuthUI.prefs.PREFS["suites.toggle"]); 
            for (i=0; i<csTglList.length; i++) {
                csTglList[i].state = "default";
            }
            prefs.setCharPref("extensions.ssleuth.suites.toggle", 
				JSON.stringify(csTglList));
			break;
		case 'ssleuth-menu-cs-custom-list' 	:
			SSleuthPreferences.openTab(2); 
			break;
		case 'ssleuth-menu-open-preferences' : 
			SSleuthPreferences.openTab(0);
			break;
		case 'ssleuth-menu-open-about'	:
			SSleuthPreferences.openTab(3);
			break; 
	}
}

function createPanelMenu(doc) {
	var menupopup = doc.createElement("menupopup"); 	
	menupopup.setAttribute("id", "ssleuth-panel-menu"); 
	menupopup.setAttribute("position", "after_start"); 

	var menuitem = doc.createElement("menuitem"); 
	menuitem.setAttribute("label", "Preferences"); 
	// addEventLisetener() won't work if we clone the parent nodes.
	// the remaining option is to go with an in-line listener.
	menuitem.setAttribute("id", "ssleuth-menu-open-preferences"); 
	menupopup.appendChild(menuitem); 

	menupopup.appendChild(doc.createElement("menuseparator"));

	menuitem = doc.createElement("menuitem"); 
	menuitem.setAttribute("label", "Reset All"); 
	menuitem.setAttribute("id", "ssleuth-menu-cs-reset-all"); 
	menupopup.appendChild(menuitem); 

	menuitem = doc.createElement("menuitem"); 
	menuitem.setAttribute("label", "Custom list"); 
	menuitem.setAttribute("id", "ssleuth-menu-cs-custom-list"); 
	menupopup.appendChild(menuitem); 

	menupopup.appendChild(doc.createElement("menuseparator"));
	menuitem = doc.createElement("menuitem");
	menuitem.setAttribute("label", "About");
	
	menuitem.setAttribute("id", "ssleuth-menu-open-about"); 
	menupopup.appendChild(menuitem); 

	SSleuthUI.panelMenuTemplate = menupopup.cloneNode(true);

	/* Right place to insert the menupopup? */
	doc.documentElement.appendChild(menupopup); 
}

function removePanelMenu(doc) {
	var menupopup = doc.getElementById("ssleuth-panel-menu"); 

	menupopup.parentElement.removeChild(menupopup); 
}

function forEachOpenWindow(todo) {
	var windows = Services.wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements())
		todo(windows.getNext()
			.QueryInterface(Components.interfaces.nsIDOMWindow));
}

var prefListener = new PrefListener(
	SSleuthPreferences.prefBranch,
	function(branch, name) {
		switch(name) {
			case "notifier.location":
				// Changing the notifier location requires tearing down
				// everything. Button, panel.. and the panel overlay!
				SSleuthUI.prefs.PREFS[name] = branch.getIntPref(name); 
				forEachOpenWindow(function(win) {
					SSleuthUI.uninit(win); 
				}); 
			
				forEachOpenWindow(function(win) {
					SSleuthUI.init(win); 
				}); 
				break;
			case "panel.fontsize":
				SSleuthUI.prefs.PREFS[name] = branch.getIntPref(name); 
				forEachOpenWindow(function(win) {
					setPanelFont(branch.getIntPref(name), win.document); 
				}); 
				break;
			case "ui.keyshortcut":
				SSleuthUI.prefs.PREFS[name] = branch.getCharPref(name); 
				forEachOpenWindow(function(win) {
					deleteKeyShortcut(win.document); 
					createKeyShortcut(win.document); 
				}); 
			case "panel.info" :
				SSleuthUI.prefs.PREFS[name] = 
					JSON.parse(branch.getCharPref(name)); 
		}
	}
); 

