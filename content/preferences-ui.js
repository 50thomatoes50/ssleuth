(function () {

	// cx = connection rating
	// cs = cipher suite rating
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
	const PREF_CX_RATING = "extensions.ssleuth.rating.params"; 
	const PREF_CS_RATING = "extensions.ssleuth.rating.ciphersuite.params"; 
	var cxRating = JSON.parse(prefs.getCharPref(PREF_CX_RATING)); 
	var csRating = JSON.parse(prefs.getCharPref(PREF_CS_RATING)); 

	var prefUI = {
		init : function() {
			var prefTabbox = document.getElementById("ssleuth-preferences-tabbox");
			if("arguments" in window && window.arguments.length > 0) {
				prefTabbox.selectedIndex = window.arguments[0].tabIndex;
			}

			prefUI.initRatings(); 
			prefUI.addListeners(); 

		},

		initRatings: function() {
			document.getElementById("ssleuth-pref-cipher-suite-weight").value
					= cxRating.cipherSuite;
			document.getElementById("ssleuth-pref-pfs-weight").value
					= cxRating.pfs;
			document.getElementById("ssleuth-pref-ev-weight").value
					= cxRating.evCert;
			document.getElementById("ssleuth-pref-ffstatus-weight").value
					= cxRating.ffStatus;
			document.getElementById("ssleuth-pref-certstate-weight").value
					= cxRating.certStatus;

			document.getElementById("ssleuth-pref-cs-kx-weight").value 
					= csRating.keyExchange;
			document.getElementById("ssleuth-pref-cs-cipher-weight").value
					= csRating.bulkCipher;
			document.getElementById("ssleuth-pref-cs-hmac-weight").value
					= csRating.hmac;

			// Set the total value for the first time. 
			prefUI.cxRatingChanged(); 
			prefUI.csRatingChanged(); 
		}, 

		cxRatingChanged: function() {
			var total = 0; 
			for (i=0; i<cxRatingIds.length; i++) {
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

		addListeners: function() {
			for (i=0; i<cxRatingIds.length; i++) {
				document.getElementById(cxRatingIds[i])  
					.addEventListener("change", prefUI.cxRatingChanged, false); 
			}
			for (i=0; i<csRatingIds.length; i++) {
				document.getElementById(csRatingIds[i]) 
					.addEventListener("change", prefUI.csRatingChanged, false); 
			}
			document.getElementById("ssleuth-pref-cx-ratings-apply")
				.addEventListener("command", prefUI.cxRatingApply, false); 
			document.getElementById("ssleuth-pref-cs-ratings-apply")
				.addEventListener("command", prefUI.csRatingApply, false); 
		}, 

		cxRatingApply : function() {
			cxRating.cipherSuite = 
				document.getElementById("ssleuth-pref-cipher-suite-weight").value; 
			cxRating.pfs = 
				document.getElementById("ssleuth-pref-pfs-weight").value;
			cxRating.evCert = 
				document.getElementById("ssleuth-pref-ev-weight").value;
			cxRating.ffStatus = 
				document.getElementById("ssleuth-pref-ffstatus-weight").value;
			cxRating.certStatus = 
				document.getElementById("ssleuth-pref-certstate-weight").value;
			cxRating.total = Number(cxRating.cipherSuite) +
								Number(cxRating.pfs) +
								Number(cxRating.evCert) +
								Number(cxRating.ffStatus) +
								Number(cxRating.certStatus); 
			prefs.setCharPref(PREF_CX_RATING, 
				JSON.stringify(cxRating)); 
		},
		csRatingApply : function() {
			csRating.keyExchange = 
				document.getElementById("ssleuth-pref-cs-kx-weight").value; 
			csRating.bulkCipher = 
				document.getElementById("ssleuth-pref-cs-cipher-weight").value;
			csRating.hmac = 
				document.getElementById("ssleuth-pref-cs-hmac-weight").value;
			csRating.total = Number(csRating.keyExchange) +
								Number(csRating.bulkCipher) +
								Number(csRating.hmac);
			prefs.setCharPref(PREF_CS_RATING, 
				JSON.stringify(csRating)); 
		},

	};
	window.addEventListener("load", prefUI.init, false); 

}());
