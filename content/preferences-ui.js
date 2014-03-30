(function () {

	// cx = connection 
	// cs = cipher suite 
	var cxRatingIds = [
		"ssleuth-pref-cipher-suite-weight",
		"ssleuth-pref-pfs-weight",
		"ssleuth-pref-ev-weight",
		"ssleuth-pref-ffstatus-weight",
		"ssleuth-pref-certstate-weight"
	];
	var csRatingIds = [
		"ssleuth-pref-cs-kx-weight",
		"ssleuth-pref-cs-cipher-weight",
		"ssleuth-pref-cs-hmac-weight"
	];
	const Cc = Components.classes;
	const Ci = Components.interfaces;
	const prefs = Cc["@mozilla.org/preferences-service;1"]
						.getService(Ci.nsIPrefBranch);

	const PREF_NOTIF_LOC = "extensions.ssleuth.notifier.location";
	const PREF_PANEL_FONT = "extensions.ssleuth.panel.fontsize"; 
	const PREF_CX_RATING = "extensions.ssleuth.rating.params"; 
	const PREF_CS_RATING = "extensions.ssleuth.rating.ciphersuite.params"; 
	const PREF_SUITES_TGL = "extensions.ssleuth.suites.toggle"; 
	const PREF_PANEL_INFO = "extensions.ssleuth.panel.info"; 

	var cxRating = JSON.parse(prefs.getCharPref(PREF_CX_RATING)); 
	var csRating = JSON.parse(prefs.getCharPref(PREF_CS_RATING)); 
	var csTglList = JSON.parse(prefs.getCharPref(PREF_SUITES_TGL));
	var panelInfo = JSON.parse(prefs.getCharPref(PREF_PANEL_INFO)); 

	var prefUI = {
		editMode : false,
		editItem : null, 
		editListbox : null, 
		editEntry : null, 
		newItemMode: false, 

		init : function() {
			prefUI.initUIOptions();
			prefUI.initRatings(); 
			prefUI.initMngList(); 
			prefUI.addListeners(); 
			document.getElementById("ssleuth-pref-categories")
					.selectedIndex = Application.storage.get("ssleuth.prefwindow.tabindex", 0); 
		},

		selectIndex: function(e) {
			document.getElementById("ssleuth-pref-categories")
					.selectedIndex = e.detail; 
		},

		initUIOptions: function() {
			document.getElementById("ssleuth-pref-notifier-location").value
				= prefs.getIntPref(PREF_NOTIF_LOC);
			document.getElementById("ssleuth-pref-panel-fontsize").value 
				= prefs.getIntPref(PREF_PANEL_FONT);

			panelInfo = JSON.parse(prefs.getCharPref(PREF_PANEL_INFO)); 
			for (var [id, val] in Iterator({
				"ssleuth-pref-show-cs-hmac"				: panelInfo.HMAC,
				"ssleuth-pref-show-cs-bulk-cipher" 		: panelInfo.bulkCipher,
				"ssleuth-pref-show-cs-key-exchange" 	: panelInfo.keyExchange,
				"ssleuth-pref-show-cs-cert-sig"			: panelInfo.authAlg, 
				"ssleuth-pref-show-cert-validity"		: panelInfo.certValidity, 
				"ssleuth-pref-show-cert-validity-time"	: panelInfo.validityTime, 
				"ssleuth-pref-show-cert-fingerprint"	: panelInfo.certFingerprint, 
				})) {
					document.getElementById(id).checked = val; 
			}
		},

		initRatings: function() {
			cxRating = JSON.parse(prefs.getCharPref(PREF_CX_RATING)); 
			csRating = JSON.parse(prefs.getCharPref(PREF_CS_RATING)); 
			for (var [id, val] in Iterator({
				"ssleuth-pref-cipher-suite-weight" : cxRating.cipherSuite, 
				"ssleuth-pref-pfs-weight"		: cxRating.pfs,
				"ssleuth-pref-ev-weight"		: cxRating.evCert,
				"ssleuth-pref-ffstatus-weight"	: cxRating.ffStatus,
				"ssleuth-pref-certstate-weight"	: cxRating.certStatus,
				"ssleuth-pref-cs-kx-weight"		: csRating.keyExchange,
				"ssleuth-pref-cs-cipher-weight" : csRating.bulkCipher,
				"ssleuth-pref-cs-hmac-weight"	: csRating.hmac
				})) {
					document.getElementById(id).value = val; 
			}
			// Set the total value for the first time. 
			prefUI.cxRatingChanged(); 
			prefUI.csRatingChanged(); 
		}, 

		initMngList: function() {
			var csBox = document.getElementById("ssleuth-pref-mng-cs-entrybox"); 
			var csDeck = document.getElementById("ssleuth-pref-mng-cs-deck"); 
			
			// Clear any existing elements - to help with re-init after edits
			// For items list, keep the header and remove listitems.
			var li = csBox.firstChild.nextSibling;
			while (li) {
				var t = li; 
				li =  li.nextSibling;
				csBox.removeChild(t);
			}
			while (csDeck.hasChildNodes()) {
				csDeck.removeChild(csDeck.firstChild); 
			}

			// Make sure csTglList is consistent with that in preferences.
			csTglList = JSON.parse(prefs.getCharPref(PREF_SUITES_TGL));
			for (t=0; t<csTglList.length; t++) {
				var cs = csTglList[t]; 
				var item = document.createElement("richlistitem");
				var hbox = document.createElement("hbox"); 
				var lb = document.createElement("label");
				hbox.setAttribute("equalsize", "always"); 
				hbox.setAttribute("flex", "1"); 
				lb.setAttribute("value", cs.name);
				lb.setAttribute("flex", "1");
				hbox.appendChild(lb);
				
				rg = document.createElement("radiogroup");
				rg.setAttribute("orient", "horizontal");
				rg.setAttribute("flex", "1");
				for (var s of ["Default", "Enable", "Disable"]) {
					rd = document.createElement("radio"); 
					rd.setAttribute("label", s);
					rd.setAttribute("value", s.toLowerCase()); 
					if (cs.state == s.toLowerCase()) {
						rd.setAttribute("selected", "true");
					}
					rg.appendChild(rd); 
				}
				rg.addEventListener("command", prefUI.csMngEntryRadioEvent, false); 

				hbox.appendChild(rg); 
				item.appendChild(hbox);
				csBox.appendChild(item); 
				
				var box = document.createElement("listbox");
				for (var i=0; i<cs.list.length; i++) {
					var dItem = document.createElement("listitem"); 
					
					dItem.setAttribute("label", cs.list[i]);
					box.appendChild(dItem);
				}
				csDeck.appendChild(box); 
			}
		},

		addListeners: function() {
			for (i=0; i<cxRatingIds.length; i++) {
				document.getElementById(cxRatingIds[i])  
					.addEventListener("change", prefUI.cxRatingChanged, false); 
			}
			for (i=0; i<csRatingIds.length; i++) {
				document.getElementById(csRatingIds[i]) 
					.addEventListener("change", prefUI.csRatingChanged, false); 
			}
			for (var [id, func] in Iterator({
				"ssleuth-pref-notifier-location"	: prefUI.notifLocChange, 
				"ssleuth-pref-panel-fontsize"		: prefUI.panelFontChange, 
				"ssleuth-pref-cx-ratings-apply" 	: prefUI.cxRatingApply,
				"ssleuth-pref-cx-ratings-reset" 	: prefUI.cxRatingReset, 
				"ssleuth-pref-cs-ratings-apply" 	: prefUI.csRatingApply,
				"ssleuth-pref-cs-ratings-reset" 	: prefUI.csRatingReset,
				"ssleuth-pref-mng-cs-entry-new" 	: prefUI.csMngEntryNew,
				"ssleuth-pref-mng-cs-entry-edit"	: prefUI.csMngEntryEdit,
				"ssleuth-pref-mng-cs-entry-remove" 	: prefUI.csMngEntryRemove,
				"ssleuth-pref-mng-cs-edit-apply" 	: prefUI.csMngEntryEditApply,
				"ssleuth-pref-mng-cs-edit-cancel" 	: prefUI.csMngEntryEditCancel,
				"ssleuth-pref-mng-cs-entry-restore-default" : prefUI.csMngEntryRestoreDefault,
				"ssleuth-pref-cs-reset-all-cs"		: prefUI.csResetAll,
				"ssleuth-pref-show-cs-hmac"			: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-cs-bulk-cipher" 		: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-cs-key-exchange"		: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-cs-cert-sig"			: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-cert-validity"		: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-cert-validity-time"	: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-cert-fingerprint"	: prefUI.panelInfoCheck, 
				"ssleuth-pref-show-panel-info-reset"	: prefUI.panelInfoReset, 
			}) ) {
				document.getElementById(id)
					.addEventListener("command", func, false); 
			}
			document.getElementById("ssleuth-pref-mng-cs-entrybox")
				.addEventListener("select", prefUI.csMngEntrySelect, false);
			document.getElementById("ssleuth-pref-mng-cs-entrybox")
				.addEventListener("dblclick", prefUI.csMngEntryEdit, false);
		}, 

		notifLocChange: function() {
			prefs.setIntPref(PREF_NOTIF_LOC, 
				document.getElementById("ssleuth-pref-notifier-location").value);
		},
		panelFontChange: function() {
			prefs.setIntPref(PREF_PANEL_FONT,
				document.getElementById("ssleuth-pref-panel-fontsize").value);
		},

		panelInfoCheck: function() {
			panelInfo.HMAC = 
				document.getElementById("ssleuth-pref-show-cs-hmac").checked;
			panelInfo.bulkCipher = 
				document.getElementById("ssleuth-pref-show-cs-bulk-cipher").checked;
			panelInfo.keyExchange = 
				document.getElementById("ssleuth-pref-show-cs-key-exchange").checked;
			panelInfo.authAlg = 
				document.getElementById("ssleuth-pref-show-cs-cert-sig").checked;
			panelInfo.certValidity = 
				document.getElementById("ssleuth-pref-show-cert-validity").checked;
			panelInfo.validityTime = 
				document.getElementById("ssleuth-pref-show-cert-validity-time").checked;
			panelInfo.certFingerprint = 
				document.getElementById("ssleuth-pref-show-cert-fingerprint").checked;
			prefs.setCharPref(PREF_PANEL_INFO, JSON.stringify(panelInfo)); 
		},
		panelInfoReset: function() {
			prefs.clearUserPref(PREF_PANEL_INFO); 
			prefUI.initUIOptions(); 
		},

		cxRatingChanged: function() {
			for (var total=0, i=0; i<cxRatingIds.length; i++) {
				total += Number(document.getElementById(cxRatingIds[i]).value);
			}
			document.getElementById("ssleuth-pref-cx-rating-total").value = total; 
		},
		csRatingChanged: function() {
			var total = 0; 
			for (i=0; i<csRatingIds.length; i++) {
				total += Number(document.getElementById(csRatingIds[i]).value); 
			}
			document.getElementById("ssleuth-pref-cs-rating-total").value = total; 
		},

		csMngEntryNew : function() {
			var csBox = document.getElementById("ssleuth-pref-mng-cs-entrybox"); 
			var csDeck = document.getElementById("ssleuth-pref-mng-cs-deck"); 

			var item = document.createElement("richlistitem");
			var hbox = document.createElement("hbox"); 
			var lb = document.createElement("label");
			hbox.setAttribute("equalsize", "always"); 
			hbox.setAttribute("flex", "1"); 

			lb.setAttribute("flex", "1");
			lb.setAttribute("value", "<Custom suites>");
			hbox.appendChild(lb);
			item.appendChild(hbox); 
			csBox.appendChild(item);
			csBox.selectItem(item);	

			// Deck 
			var box = document.createElement("listbox");
			var chList = prefs.getChildList("security.ssl3.", {}); 

			for (var i=0; i<chList.length; i++) {
				var dItem = document.createElement("listitem"); 
					
				dItem.setAttribute("label", 
						chList[i].replace("security.ssl3.", ""));
				box.appendChild(dItem);
			}
			csDeck.appendChild(box);
			prefUI.newItemMode = true;
			prefUI.csMngEntryEdit();
		},

		csMngEntryEdit : function() {
			var csBox = document.getElementById("ssleuth-pref-mng-cs-entrybox"); 
			var csDeck = document.getElementById("ssleuth-pref-mng-cs-deck"); 

			var item = csBox.selectedItem;
			if (!item) {
				return;
			}
			var lb = item.firstChild.firstChild; 
			var label = lb.value; 
			var rd = lb.nextSibling; 

			// Replace the label/radios and insert a textbox there.
			var tb = document.createElement("textbox");
			tb.setAttribute("flex", "1");

			if (rd != null) {
				item.firstChild.removeChild(rd); 
			}
			item.firstChild.replaceChild(tb, lb);
			tb.setAttribute("value", label);
			tb.select();

			// == Deck ==
			var deck = csDeck.selectedPanel; 
			var csList = []; 
			if (deck.hasChildNodes()) {
				var li = deck.childNodes; 
				for (var i = 0; i<li.length; i++) {
					csList[i] = li[i].getAttribute("label");
				}
			}

			var box = document.createElement("listbox");
			for (var i=0; i<csList.length; i++) {
				var dItem = document.createElement("listitem"); 
				
				dItem.setAttribute("type", "checkbox");
				dItem.setAttribute("label", csList[i]);
				dItem.setAttribute("allowevents", "true");
				if (!prefUI.newItemMode) 
					dItem.setAttribute("checked", "true"); 
				box.appendChild(dItem);
			}
			csDeck.replaceChild(box, deck); 

			// Enable edit mode, and apply/cancel.  
			// Disable new/edit/remove/ buttons.
			document.getElementById("ssleuth-pref-mng-cs-edit-buttons").hidden = false;

			prefUI.editMode = true; 
			prefUI.editItem = item; 
			prefUI.editListbox = box; 
			prefUI.editEntry = label; 

			prefUI.hideCsMngEntryButtons("true"); 
			// Disable double click event listener
			document.getElementById("ssleuth-pref-mng-cs-entrybox")
				.removeEventListener("dblclick", prefUI.csMngEntryEdit);
		},

		csMngEntryEditApply: function() {
			var label = prefUI.editItem.firstChild.firstChild.value;
			var lb = prefUI.editListbox; 
			var oldLabel = prefUI.editEntry; 
			var csList = []; 

			if (lb.hasChildNodes()) {
				var li = lb.childNodes; 
				for (var i = 0; i<li.length; i++) {
					if (li[i].checked) {
						csList.push(li[i].getAttribute("label"));
					}
				}
			}
			var newTgl = { name : label, list : csList, state : "default"}; 
			var i=0; 
			if (prefUI.newItemMode) {
				// Check for duplicates!
				for (i=0; i<csTglList.length; i++) {
					if (label === csTglList[i].name) {
						// Silent return ? Warn the user ?? More UI stuff!
						return; 
					}
				}
				csTglList.push(newTgl); 
			} else {
				for (i=0; i<csTglList.length; i++) {
					if (oldLabel === csTglList[i].name) {
						csTglList[i] = newTgl; 
						break; 
					}
				}
			}

			prefs.setCharPref(PREF_SUITES_TGL, JSON.stringify(csTglList)); 
			prefUI.csMngEntryEditReset(); 
		},

		csMngEntryEditCancel: function() {
			prefUI.csMngEntryEditReset();
		},

		hideCsMngEntryButtons: function(flag) {
			for (var id of [
				"ssleuth-pref-mng-cs-entry-new",
				"ssleuth-pref-mng-cs-entry-edit",
				"ssleuth-pref-mng-cs-entry-remove",
				"ssleuth-pref-mng-cs-entry-restore-default",
				"ssleuth-pref-cs-reset-all-cs" 
				]) {
				document.getElementById(id)
					.setAttribute("disabled", flag); 
			}
		},

		csMngEntryEditReset: function() {
			prefUI.editMode = prefUI.newItemMode = false; 
			prefUI.editItem = prefUI.editListbox = prefUI.editEntry = null; 

			prefUI.hideCsMngEntryButtons("false"); 
			document.getElementById("ssleuth-pref-mng-cs-edit-buttons")
				.hidden = true;
			// Re-enable double click listener
			document.getElementById("ssleuth-pref-mng-cs-entrybox")
				.addEventListener("dblclick", prefUI.csMngEntryEdit, false);

			prefUI.initMngList(); 
		},

		csMngEntryRemove : function() {
			var csBox = document.getElementById("ssleuth-pref-mng-cs-entrybox"); 

			var item = csBox.selectedItem;
			if (!item) {
				return;
			}
			var lb = item.firstChild.firstChild; 
			var label = lb.value; 
			for (i=0; i<csTglList.length; i++) {
				if (label === csTglList[i].name) {
					csTglList.splice(i, 1);
					break;
				}
			}
			prefs.setCharPref(PREF_SUITES_TGL, JSON.stringify(csTglList)); 
			prefUI.initMngList(); 
		},

		csMngEntrySelect : function() {
			var csBox = document.getElementById("ssleuth-pref-mng-cs-entrybox"); 
			var csDeck = document.getElementById("ssleuth-pref-mng-cs-deck"); 
			csDeck.selectedIndex = csBox.selectedIndex; 
		},

		csMngEntryRadioEvent : function() {
			var csBox = document.getElementById("ssleuth-pref-mng-cs-entrybox"); 
			var item = csBox.selectedItem;
			if (!item) {
				return;
			}
			var lb = item.firstChild.firstChild; 
			var label = lb.value; 
			var rg = lb.nextSibling; 
			if (rg == null) 
				return; 
			// states = default, enable, disable
			var state = rg.value; 

			// dump("Radio event : label : " + label + " state : " + state + "\n"); 
			for (var i=0; i<csTglList.length; i++) {
				if (label === csTglList[i].name) {
					csTglList[i].state = state; 
					break; 
				}
			}

			prefs.setCharPref(PREF_SUITES_TGL, JSON.stringify(csTglList)); 
		},

		csMngEntryRestoreDefault : function() {
			prefs.clearUserPref(PREF_SUITES_TGL);
			prefUI.initMngList(); 
		},

		csResetAll : function() {
			// Now this has to be done clean. 1. User has their own list
			// 2. There are other cipher suites outside of this list.
			// While doing a reset, reset the user list to 'default'
			// 		This will clear everything in it once.
			// Also need to reset all the other ones. Optimize this?
			var csList = prefs.getChildList("security.ssl3.", {}); 
			for (var i=0; i<csList.length; i++) {
				prefs.clearUserPref(csList[i]); 
			}

			for (i=0; i<csTglList.length; i++) {
				csTglList[i].state = "default"; 
			}
			prefs.setCharPref(PREF_SUITES_TGL, JSON.stringify(csTglList)); 
			prefUI.initMngList(); 
			
		},

		cxRatingApply : function() {
			cxRating.cipherSuite = 
				Number(document.getElementById("ssleuth-pref-cipher-suite-weight").value); 
			cxRating.pfs = 
				Number(document.getElementById("ssleuth-pref-pfs-weight").value);
			cxRating.evCert = 
				Number(document.getElementById("ssleuth-pref-ev-weight").value);
			cxRating.ffStatus = 
				Number(document.getElementById("ssleuth-pref-ffstatus-weight").value);
			cxRating.certStatus = 
				Number(document.getElementById("ssleuth-pref-certstate-weight").value);
			cxRating.total = cxRating.cipherSuite +
								cxRating.pfs +
								cxRating.evCert +
								cxRating.ffStatus +
								cxRating.certStatus; 
			prefs.setCharPref(PREF_CX_RATING, 
				JSON.stringify(cxRating)); 
		},

		cxRatingReset : function() {
			prefs.clearUserPref(PREF_CX_RATING); 
			prefUI.initRatings(); 
		}, 

		csRatingApply : function() {
			csRating.keyExchange = 
				Number(document.getElementById("ssleuth-pref-cs-kx-weight").value); 
			csRating.bulkCipher = 
				Number(document.getElementById("ssleuth-pref-cs-cipher-weight").value);
			csRating.hmac = 
				Number(document.getElementById("ssleuth-pref-cs-hmac-weight").value);
			csRating.total = csRating.keyExchange +
								csRating.bulkCipher +
								csRating.hmac;
			prefs.setCharPref(PREF_CS_RATING, 
				JSON.stringify(csRating)); 
		},

		csRatingReset : function() {
			prefs.clearUserPref(PREF_CS_RATING);
			prefUI.initRatings();
		},

	};
	window.addEventListener("load", prefUI.init, false); 
	window.addEventListener("ssleuth-prefwindow-index", 
		prefUI.selectIndex, false, true); 

}());
