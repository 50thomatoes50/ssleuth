"use strict";

var EXPORTED_SYMBOLS = ["ssleuthUI", "setButtonRank", 
						"panelConnectionRank",
						"showCipherDetails",
						"showPFS",
						"showFFState",
						"showCertDetails",
						"setBoxHidden",
						"setHttpsLink",
						"setPanelFont",
						"createKeyShortcut", 
						"deleteKeyShortcut"]; 

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://ssleuth/utils.js");
Components.utils.import("resource://ssleuth/cipher-suites.js");

var ssleuthUI = {
	ssleuthLoc : { URLBAR: 0, TOOLBAR: 1 },
	ssleuthBtnLocation : null, 
	win : null, 

	init: function(window) {
		dump("\n UI init \n"); 
		
		dump ("\nssleuth UI init : \n");
		this.win = window; 

		try {
			window.document.loadOverlay("chrome://ssleuth/content/ssleuth.xul", 
								{observe: function(subject, topic, data) {
									if (topic == "xul-overlay-merged") {
										dump("\nXUL overlay merged! \n"); 
										/* TODO : Keep an eye on this 'window' element!*/
										ssleuthUI.initSSleuthUI(window); 
									}
								}});
		} catch (e) {
			dump("Failed overlay load : " + e.message + "\n"); 
		}
	},

	initSSleuthUI: function(window) {

		/* Verify if things are in good shape! */
		if(window.document.getElementById("ssleuth-panel-vbox")) {
			dump("initSSleuthUI : panel elems available!\n"); 
		} else {
			dump("** tough luck!\n");
			this.uninit(); 
		}
		readUIPreferences();
		
		var ssleuthButton = createButton(window); 
		installButton(ssleuthButton,
						true, 
						window.document); 

		createPanelMenu(window.document); 

		createKeyShortcut(window.document);
		loadStyleSheet(); 
		
		var ssleuthPanel = _ssleuthPanel(window); 
		if (ssleuthPanel == null) {
			dump("\n UI initSSleuthUI ssleuthPanel is null! \n"); 
		}
		var panelVbox = window.document.getElementById("ssleuth-panel-vbox"); 
		ssleuthPanel.appendChild(panelVbox); 

		setUIPreferences(window.document);
	}, 

	uninit: function(window) {
		dump("\n SSleuth UI  : uninit \n"); 
		/* TODO : Cleanup everything! */
		/* Removing the button deletes the overlay elements as well */
		removeButton(_ssleuthButton(window)); 

		deleteKeyShortcut(window.document); 
		removePanelMenu(window.document); 
		removeStyleSheet(); 
		/* If preferences window is open, close that too */
	},

	onLocationChange: function(window) {
		/* The document elements are not available until a 
		 * successful init. So we need to add the child panel
		 * for the first time */
		try {
			this.win = window; 
				if (window == null ) {
					dump("\n UI onLocationchange window is null! \n"); 
					return; 
				}
			} catch (e) {
			dump("Error onlocation change ssleuthpanel child : " + e.message + "\n"); 
		}

		/* If the user navigates the tabs with the panel open, 
		 *  make it appear smooth. */
		var ssleuthPanel = _ssleuthPanel(window);
		if (ssleuthPanel.state == "open") {
			showPanel(ssleuthPanel, true); 
		}
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
	return Cc["@mozilla.org/embedcomp/window-watcher;1"]
						.getService(Components.interfaces.nsIWindowWatcher)
						.activeWindow; 
}

function _ssleuthButton(window) {
	const ui = ssleuthUI; 
	const win = window; 
	if (ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR) {
		return win.document.getElementById("ssleuth-tb-button");
	} else if (ui.ssleuthBtnLocation == ui.ssleuthLoc.URLBAR) {
		return win.document.getElementById("ssleuth-box-urlbar");
	}
}

function _ssleuthBtnImg() {
	const ui = ssleuthUI; 
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
		const ui = ssleuthUI; 
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
		const ui = ssleuthUI; 
		var button; 
		var panelPosition; 

		if (ui.ssleuthBtnLocation == ui.ssleuthLoc.TOOLBAR) {
			button = document.createElement("toolbarbutton");
			button.setAttribute("id", "ssleuth-tb-button");
			button.setAttribute("removable", "true");
			button.setAttribute("class",
				"toolbarbutton-1 chromeclass-toolbar-additional");
			button.setAttribute("type", "menu-button");
			panelPosition = "bottomcenter topright"; 
			/* For a toolbar button, images can be set directly.*/
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
			/* For some strange reason, the below one doesn't work from
			 	the style sheet! */
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
		/* The toolbar button, technically being a 'button'
		 * and the panel as it's child, is automagically opened by firefox.
		 * Unlike a shortcut-key or the urlbar notifier, we don't
		 * need to open the panel in this case. */
		try {
			dump ("Panel state : " + _ssleuthPanel(_window()).state + "\n"); 
			if (!(event.type == "click" && 
					event.button == 0 &&
					ssleuthUI.ssleuthBtnLocation == ssleuthUI.ssleuthLoc.TOOLBAR )) { 
				togglePanel(_ssleuthPanel(_window())); 
			}
	 	} catch(ex) {
			dump("Error while panelEvent action : " + ex.message + "\n"); 
		}
	}
}

function menuEvent(event) {
	dump("\n menuEvent \n"); 

	try {
		event.preventDefault(); 
		var doc = _window().document; 

		var ssleuthPanelMenu = doc.getElementById("ssleuth-panel-menu"); 
		ssleuthPanelMenu.openPopup(_ssleuthButton(_window())); 
	} catch (e) { 
		dump("menuEvent error : " + e.message + "\n"); 
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

	/* I don't see any easy CSS hacks
	 * without having to autogenerate spans in html.
	 */
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

	if (ssleuthUI.ssleuthBtnLocation == ssleuthUI.ssleuthLoc.URLBAR) {
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

function showCipherDetails(cipherSuite, keyLength) {
	var doc = _window().document; 
	const cs = ssleuthCipherSuites; 
	var marginCipherStatus = "low"; 
	if (cipherSuite.rank >= cs.cipherStrength.HIGH) {
		marginCipherStatus = "high"; 
	} else if (cipherSuite.rank > cs.cipherStrength.MEDIUM) {
		marginCipherStatus = "med"; 
	}

	doc.getElementById("ssleuth-img-cipher-rank").setAttribute("status", marginCipherStatus); 

	doc.getElementById("ssleuth-text-cipher-suite").textContent = (cipherSuite.name); 
	doc.getElementById("ssleuth-text-cipher-suite-rank").textContent = (cipherSuite.rank.toFixed(1) + "/10"); 
	doc.getElementById("ssleuth-text-cipher-suite-note").textContent = (cipherSuite.notes); 
	doc.getElementById("ssleuth-text-cipher-keylength").textContent = (keyLength); 
}
function showPFS(pfs) {
	var doc = _window().document; 

	const pfsImg = doc.getElementById("ssleuth-img-p-f-secrecy"); 
	const pfsTxt = doc.getElementById("ssleuth-text-p-f-secrecy"); 

	pfsImg.setAttribute("hidden", "false"); 
	if (pfs) {
		pfsImg.setAttribute("status", "yes"); 
		pfsTxt.textContent = "Perfect Forward Secrecy : Yes";
	} else {
		pfsImg.setAttribute("status", "no"); 
		pfsTxt.textContent = "Perfect Forward Secrecy : No";
	}
}

function showFFState(state) {
	var doc = _window().document; 

	doc.getElementById("ssleuth-img-ff-connection-status").setAttribute("state", state); 
	doc.getElementById("ssleuth-text-ff-connection-status").textContent = state; 
	var brokenText = doc.getElementById("ssleuth-text-ff-connection-status-broken");
	if ( state == "Broken" || state == "Insecure") {
		brokenText.setAttribute("hidden", "false"); 
	} else {
		brokenText.setAttribute("hidden", "true"); 
	}
}

function showCertDetails(cert, domMismatch, ev) {
	var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
	var doc = _window().document; 

	doc.getElementById("ssleuth-text-cert-common-name").textContent = cert.commonName; 
	var elemEV = doc.getElementById("ssleuth-text-cert-extended-validation"); 
	var evText = (ev)? "Yes" : "No"; 
	elemEV.textContent = evText; 
	elemEV.setAttribute("ev", evText); 

	doc.getElementById("ssleuth-text-cert-org").textContent = cert.organization;
	doc.getElementById("ssleuth-text-cert-org-unit").textContent = cert.organizationalUnit;
	doc.getElementById("ssleuth-text-cert-issuer-org").textContent = cert.issuerOrganization; 
	doc.getElementById("ssleuth-text-cert-issuer-org-unit").textContent = cert.issuerOrganizationUnit; 

	var certValidity = doc.getElementById("ssleuth-text-cert-validity"); 
	var certValid = (isCertValid(cert)? "true" : "false"); 
	certValidity.setAttribute("valid", certValid); 
	certValidity.textContent = validity.notBeforeGMT + " till " + validity.notAfterGMT;

	var domainMatched = doc.getElementById("ssleuth-text-cert-domain-matched"); 
	var domMatchText = (!domMismatch)? "Yes" : "No"; 
	domainMatched.textContent = domMatchText; 
	domainMatched.setAttribute("match", domMatchText); 

	if (certValid == "true" && domMatchText == "Yes" ) {
		doc.getElementById("ssleuth-img-cert-state").setAttribute("state", "good"); 
	} else {
		doc.getElementById("ssleuth-img-cert-state").setAttribute("state", "bad"); 
	}
}
	 
function createKeyShortcut(doc) {
	var keyset = doc.createElement("keyset"); 	
	var key = doc.createElement("key"); 
	const prefs = 
		Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

	key.setAttribute("id", "ssleuth-panel-keybinding"); 
	key.addEventListener("command", panelEvent);
	/* Mozilla, I have no clue, without pointing 'oncommand' to
	 * something, the key events won't fire! I already have an 
	 * event listener for 'command'. */
	key.setAttribute("oncommand", "void(0);");

	var keys = prefs.getCharPref("extensions.ssleuth.ui.keyshortcut").split(" ");
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
	const prefs = 
		Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
	ssleuthUI.ssleuthBtnLocation = 
		prefs.getIntPref("extensions.ssleuth.notifier.location"); 
}

function setUIPreferences(doc) {
	const prefs = 
		Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

	setPanelFont(prefs.getIntPref("extensions.ssleuth.panel.fontsize"), doc); 
}

function setPanelFont(panelFont, doc) {
	var bodyFontClass = "ssleuth-text-body-class";
	var titleFontClass = "ssleuth-text-title-class";
	var configBody, configTitle; 

	/* 0 = default
	 *  1 = large
	 *  2 = larger */
	switch(panelFont) {
		case 0 :
			configBody = "ssleuth-text-body-default"; 
			configTitle = "ssleuth-text-title-default"; 
			break;
		case 1 : 
			configBody = "ssleuth-text-body-large"; 
			configTitle = "ssleuth-text-title-large"; 
			break;
		case 2 : 
			configBody = "ssleuth-text-body-larger"; 
			configTitle = "ssleuth-text-title-larger"; 
			break;
	}
	try {
		var bodyText = doc.getElementsByClassName(bodyFontClass); 
		var titleText = doc.getElementsByClassName(titleFontClass); 

		for (var i = 0; i < bodyText.length; i++) {
			bodyText[i].className = bodyFontClass + " " + configBody;
		}
		for (var i = 0; i < titleText.length; i++) {
			titleText[i].className = titleFontClass + " " + configTitle; 
		}

		/* Exception case : urlbar button text also changes with 
		 * panel body. In addition, it requires a 'plain' class. 
		 * A better way to handle this case? */ 
		var ubRank = doc.getElementById("ssleuth-ub-rank"); 
		if (ubRank) 
			ubRank.className = "plain " + bodyFontClass + " " + configBody;
	} catch(e) { 
		dump("setPanelFont error : " + e.message + "\n"); 
	}
}

function createPanelMenu(doc) {
	var menupopup = doc.createElement("menupopup"); 	
	menupopup.setAttribute("id", "ssleuth-panel-menu"); 
	menupopup.setAttribute("position", "after_start"); 

	var menuitem = doc.createElement("menuitem"); 
	menuitem.setAttribute("label", "Preferences"); 
	menuitem.addEventListener("command", function() {
		ssleuthPreferences.openDialog(0);
	});
	menupopup.appendChild(menuitem); 
	menupopup.appendChild(doc.createElement("menuseparator"));

	menuitem = doc.createElement("menuitem"); 
	menuitem.setAttribute("label", "About"); 
	menuitem.addEventListener("command", function() {
		ssleuthPreferences.openDialog(2);
	});
	menupopup.appendChild(menuitem); 

	/* Right place to insert the menupopup? */
	doc.documentElement.appendChild(menupopup); 
}

function removePanelMenu(doc) {
	var menupopup = doc.getElementById("ssleuth-panel-menu"); 

	menupopup.parentElement.removeChild(menupopup); 
}


Components.utils.import("resource://ssleuth/preferences.js");
