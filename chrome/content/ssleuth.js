Components.utils.import("resource://ssleuth/cipherSuites.js"); 

const ssleuthPanelProto = { PROTOCOLHTTP: 0, PROTOCOLHTTPS: 1, PROTOCOLUNKNOWN: 2 };
const ssleuthLoc = { URLBAR: 0, TOOLBAR: 1 }; 
var ssleuthBtnImg = null; 
var ssleuthPanelBox = null; 
var ssleuthButton = null; 
var ssleuthPanel = null; 
var ssleuthPanelMenu = null; 

var ssleuth = {
	
    protocol: ssleuthPanelProto.PROTOCOLUNKNOWN, 
    ssleuthPanelHidden: true, 
    ssleuthBtnLocation: ssleuthLoc.URLBAR, 
    prefsWindow: null, 
    prevURL: null, 
    urlChanged: false, 

    init: function() {
        dump("\n Init \n");
        /* Handle exceptions while init(). If the panel
        *  is not properly installed for the buttons, the mainPopupSet 
        *  panel elements will wreak havoc on the browser UI. */
        try {
            gBrowser.addProgressListener(this);
            ssleuthPanelBox = document.getElementById("ssleuth-panel-vbox");

            /* Read preferences here */
            this.readPreferences(); 
            /* Set button location */
            this.ssleuthInstallButton(this.ssleuthBtnLocation); 
            this.setButtonRank(-1);
        } catch(e) {
            dump("\n Error : \n" + e.message + "\n"); 
            this.uninit();
        }
    },

    uninit: function() {
        dump("\n Uninit \n");
        gBrowser.removeProgressListener(this);
    },

    /* QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                           "nsISupportsWeakReference"]),*/

    onLocationChange: function(aProgress, aRequest, aURI) {
        if (aURI.spec == this.prevURL) {
            this.urlChanged = false; 
            return; 
        }
        this.urlChanged = true; 
        this.prevURL = aURI.spec; 

        /* If the user navigates the tabs with the panel open, 
         *  make it appear smooth. */
        if (ssleuthPanel.state == "open") {
           this.showPanel(ssleuthPanel, true); 
        } 
    },
    onProgressChange: function() {
        return;
    },
    onStatusChange: function() {
        return;
    },

    onSecurityChange: function(aWebProgress, aRequest, aState) { 
        if (window.content.location.protocol == "https:" ) {
            this.protocol = ssleuthPanelProto.PROTOCOLHTTPS; 
            ssleuth.protocolHttps(aWebProgress, aRequest, aState);
        } else if(window.content.location.protocol == "http:" ) {
            this.protocol = ssleuthPanelProto.PROTOCOLHTTP; 
            ssleuth.protocolHttp();
        } else {
            this.protocol = ssleuthPanelProto.PROTOCOLUNKNOWN; 
            ssleuth.protocolUnknown(); 
        }
    },

    readPreferences: function() {
        const prefs = 
            Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
        this.ssleuthBtnLocation = prefs.getIntPref("extensions.ssleuth.notifier.location"); 

        /* 0 = default
         *  1 = large
         *  2 = larger */
        var panelFont = prefs.getIntPref("extensions.ssleuth.panel.fontsize"); 
        var bodyFontClass = " ssleuth-text-body-default"
        var titleFontClass = " ssleuth-text-title-default"
        if (panelFont == 1) {
            bodyFontClass = " ssleuth-text-body-large"; 
            titleFontClass = " ssleuth-text-title-large"; 
        } else if (panelFont == 2) {
            bodyFontClass = " ssleuth-text-body-larger"; 
            titleFontClass = " ssleuth-text-title-larger"; 
        }

        var bodyText = document.getElementsByClassName("ssleuth-text-body-default"); 
        var titleText = document.getElementsByClassName("ssleuth-text-title-default"); 

        for (var i = 0; i < bodyText.length; i++) {
            bodyText[i].className += bodyFontClass;
        }
        for (var i = 0; i < titleText.length; i++) {
            titleText[i].className += titleFontClass; 
        }

        var keyShorcut = prefs.getCharPref("extensions.ssleuth.ui.keyshortcut"); 
        var ssleuthKeyBinding = document.getElementById("ssleuth-panel-keybinding");
        var keyArray = keyShorcut.split(" "); 
        var len = keyArray.length; 
        ssleuthKeyBinding.setAttribute("key", keyArray.splice(len-1, 1)); 
        ssleuthKeyBinding.setAttribute("modifiers", keyArray.join(" ")); 
    }, 

    ssleuthInstallButton: function(location) {
        var btnUbar = document.getElementById("ssleuth-box-urlbar");
        var pnlUbar = document.getElementById("ssleuth-panel-urlbar");
        var btnTbar = document.getElementById("ssleuth-button-toolbar");
        var pnlTbar = document.getElementById("ssleuth-panel-toolbar");

        if (location == ssleuthLoc.URLBAR) {
            /* XUL can do?. Insert the urlbar button ourselves */
            ssleuthButton = btnUbar; 
            var parent = document.getElementById("urlbar");
            parent.insertBefore(ssleuthButton, document.getElementById("identity-box")); 

            ssleuthPanel = pnlUbar; 
            ssleuthPanel.appendChild(ssleuthPanelBox);
            
            ssleuthBtnImg = document.getElementById("ssleuth-ub-img"); 

            btnTbar.hidden = true;
            pnlTbar.hidden = true; 

        } else if (location == ssleuthLoc.TOOLBAR) {
            ssleuthButton = btnTbar; 
            ssleuthPanel = pnlTbar; 
            ssleuthPanel.appendChild(ssleuthPanelBox);

            ssleuthBtnImg = document.getElementById("ssleuth-tb-img"); 
            btnUbar.hidden = true; 
            pnlUbar.hidden = true; 
        } else {
            /* else what. */
        }
        /* Add popup menu */
        ssleuthPanelMenu = document.getElementById("ssleuth-panel-menu");
        /* ssleuthPanelMenu.anchorNode = ssleuthButton; */

    },

    xulPanelEvent: function(event) {

        /* dump("\n XUL Panel Event : " + event.type + "\n"); */
        if (event.type == "click" && event.button == 2) {
            /* ssleuth.openPreferences(); */
        } else {
            /* The toolbar button, technically being a 'button'
             * and the panel as it's child, is automagically opened by firefox.
             * Unlike a shortcut-key or the urlbar notifier, we don't
             * need to open the panel in this case. */
            if (!(event.type == "click" && 
                    event.button == 0 &&
                    this.ssleuthBtnLocation == ssleuthLoc.TOOLBAR )) {
                ssleuth.togglePanel(ssleuthPanel); 
            }
        }
    },
    xulPopupMenu: function(event) {
        event.preventDefault(); 

        ssleuthPanelMenu.openPopup(ssleuthButton); 
    },

    showPanel: function(panel, show) {
        if (show) {
            panel.openPopup(ssleuthButton); 
            this.ssleuthPanelHidden = false; 
        } else {
            panel.hidePopup(); 
            this.ssleuthPanelHidden = true; 
        }
    },

    togglePanel: function(panel) {
        if (panel.state == "closed") {
            this.showPanel(panel, true); 
        } else if (panel.state == "open") {
            this.showPanel(panel, false); 
        }
    },

    protocolUnknown: function() {
        const pHttp = document.getElementById('ssleuth-panel-vbox-http'); 
        const pHttps = document.getElementById('ssleuth-panel-vbox-https'); 

        this.setButtonRank(-1); 
        pHttps.hidden = true; 
        pHttp.hidden = true; 
    },

    protocolHttp: function() {
        const pHttp = document.getElementById('ssleuth-panel-vbox-http'); 
        const pHttps = document.getElementById('ssleuth-panel-vbox-https'); 

        this.setButtonRank(-1);

        pHttps.hidden = true; 
        pHttp.hidden = false; 

        var httpURL = window.content.location.toString(); 
        var httpsURL = httpURL.replace("http://", "https://"); 

        var panelLink = document.getElementById("ssleuth-panel-https-link"); 
        panelLink.href = httpsURL; 
        panelLink.value = httpsURL; 
    },

    protocolHttps: function(aWebProgress, aRequest, aState) {
        const Cc = Components.classes; 
        const Ci = Components.interfaces;

        const pHttp = document.getElementById('ssleuth-panel-vbox-http'); 
        const pHttps = document.getElementById('ssleuth-panel-vbox-https'); 
        var secUI = gBrowser.securityUI; 

        pHttp.hidden = true;
        pHttps.hidden = false; 

        if (secUI) {
            var sslStatus = secUI.SSLStatus; 
            if (sslStatus) {
                var securityState = "";
                var cipherName = sslStatus.cipherName; 
                var cipherSuite = null; 
                var keyLength = sslStatus.keyLength; 
                var secretKeyLength = sslStatus.secretKeyLength; 
                var cert = sslStatus.serverCert;
                var extendedValidation = false;

                for (var i = 0; i < cipherSuites.length; i++) {
                    if (cipherName == cipherSuites[i].name) {
                        cipherSuite = cipherSuites[i];
                        break; 
                    }
                }
                // Security Info - Firefox states
                if ((aState & Ci.nsIWebProgressListener.STATE_IS_SECURE)) {
                    securityState = "Secure"; 
                } else if ((aState & Ci.nsIWebProgressListener.STATE_IS_INSECURE)) {
                    securityState = "Insecure"; 
                } else if ((aState & Ci.nsIWebProgressListener.STATE_IS_BROKEN)) {
                    securityState = "Broken"; 
                }

                if (aState & Ci.nsIWebProgressListener.STATE_IDENTITY_EV_TOPLEVEL) {
                    extendedValidation = true; 
                }
                var domainNameMatched = "No"; 
                if (!sslStatus.isDomainMismatch) {
                    domainNameMatched = "Yes"; 
                }
                //  UI  
                if (!cipherSuite) {
                    /* Something's missing in our list.
                     * Get the security strength from Firefox's own flags.*/
                    cipherSuite = {name: sslStatus.cipherName, 
                                    rank: cipherStrength.LOW, 
                                    pfs: 0, 
                                    notes: "Missing Cipher details. Using Firefox Security Strength flags."
                                  }
                    // Get PFS from cipherName
                    if ((cipherSuite.name.indexOf('TLS_DHE') != -1 ) || 
                        (cipherSuite.name.indexOf('TLS_ECDHE') != -1) ) {
                            cipherSuite.pfs = 1; 
                    }

                    // Set cipherSuite rank
                    if (aState & Ci.nsIWebProgressListener.STATE_SECURE_HIGH) { 
                        cipherSuite.rank = cipherStrength.MAX; 
                    } else if (aState & Ci.nsIWebProgressListener.STATE_SECURE_MED) { 
                        cipherSuite.rank = cipherStrength.HIGH - 1; 
                    } else if (aState & Ci.nsIWebProgressListener.STATE_SECURE_LOW) { 
                        cipherSuite.rank = cipherStrength.MED - 1; 
                    } 
                } 

                var connectionRank = cipherSuite.rank/2; 
                if (cipherSuite.pfs) {
                    connectionRank += 2; 
                }

                if (aState & Ci.nsIWebProgressListener.STATE_IDENTITY_EV_TOPLEVEL) {
                    connectionRank += 1; 
                }

                if (!sslStatus.isDomainMismatch && ssleuth.isCertValid(cert)) {
                    connectionRank += 1; 
                }

                if (aState & Ci.nsIWebProgressListener.STATE_SECURE_HIGH) {
                    connectionRank += 1; 
                }

                // Now set the appropriate button
                this.setButtonRank(connectionRank); 
                this.xulPopupConnectionRank(connectionRank); 

                this.showCipherDetails(cipherSuite, keyLength); 
                this.showPFS(cipherSuite.pfs); 
                this.showFFState(securityState); 
                this.showCertDetails(cert, sslStatus.isDomainMismatch, extendedValidation); 
           
            } else {
                /* 1. A rather annoying behaviour : Firefox do not seem to populate
                 * SSLStatus if a tab switches to a page with the same URL.
                 */

                /* 2. A page load event can fire even if there is 
                 * no connectivity and user attempts to reload a page. 
                 * The hidden=true should prevent stale values from getting 
                 * displayed */
                if (this.urlChanged) {
                    pHttps.hidden = true; 
                } 
            }
        }
    },

    xulPopupConnectionRank: function(rank) {
        var s = []; 

        /* This is ugly, but I don't see any easy CSS hacks
         * without having to autogenarate spans in html.
         */
        for (var i=1; i<=10; i++) {
            s[i] = document.getElementById("ssleuth-img-cipher-rank-star-" + String(i)); 
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
        document.getElementById("ssleuth-text-cipher-rank-numeric").textContent = (rank + "/10"); 
    },
    setButtonRank: function(connectionRank) {
        var buttonRank = "default"; 
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
        ssleuthBtnImg.setAttribute("rank", buttonRank); 
        if (this.ssleuthBtnLocation == ssleuthLoc.URLBAR) {
            var ssleuthUbRank = document.getElementById("ssleuth-ub-rank");  

            ssleuthUbRank.setAttribute("rank", buttonRank);
            if (connectionRank != -1) {
                ssleuthUbRank.textContent = String(connectionRank.toFixed(1)); 
            } else {
                ssleuthUbRank.textContent = ""; 
            }
            ssleuthButton.setAttribute("rank", buttonRank); 
        }
    },
    showCipherDetails: function(cipherSuite, keyLength) {
        var marginCipherStatus = "low"; 
        if (cipherSuite.rank >= cipherStrength.HIGH) {
            marginCipherStatus = "high"; 
        } else if (cipherSuite.rank > cipherStrength.MEDIUM) {
            marginCipherStatus = "med"; 
        }
        document.getElementById("ssleuth-img-cipher-rank").setAttribute("status", marginCipherStatus); 

        document.getElementById("ssleuth-text-cipher-suite").textContent = (cipherSuite.name); 
        document.getElementById("ssleuth-text-cipher-suite-rank").textContent = (cipherSuite.rank + "/10"); 
        document.getElementById("ssleuth-text-cipher-suite-note").textContent = (cipherSuite.notes); 
        document.getElementById("ssleuth-text-cipher-keylength").textContent = (keyLength); 
    },
    showPFS: function(pfs) {
        const pfsImg = document.getElementById("ssleuth-img-p-f-secrecy"); 
        const pfsTxt = document.getElementById("ssleuth-text-p-f-secrecy"); 

        pfsImg.setAttribute("hidden", "false"); 
        if (pfs) {
            pfsImg.setAttribute("status", "yes"); 
            pfsTxt.textContent = "Perfect Forward Secrecy : Yes";
        } else {
            pfsImg.setAttribute("status", "no"); 
            pfsTxt.textContent = "Perfect Forward Secrecy : No";
        }
    },
    showFFState: function(state) {
        document.getElementById("ssleuth-img-ff-connection-status").setAttribute("state", state); 
        document.getElementById("ssleuth-text-ff-connection-status").textContent = state; 
        var brokenText = document.getElementById("ssleuth-text-ff-connection-status-broken");
        if ( state == "Broken" || state == "Insecure") {
            brokenText.setAttribute("hidden", "false"); 
        } else {
            brokenText.setAttribute("hidden", "true"); 
        }
            
    },
    isCertValid: function(cert) {
        var usecs = new Date().getTime(); 
        var valid = false;
        if (usecs > cert.validity.notBefore/1000 && usecs < cert.validity.notAfter/1000) {
            valid = true; 
        } 
        return valid; 
    },
        
    showCertDetails: function(cert, domMismatch, ev) {
        var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);

        document.getElementById("ssleuth-text-cert-common-name").textContent = cert.commonName; 
        var elemEV = document.getElementById("ssleuth-text-cert-extended-validation"); 
        var evText = (ev)? "Yes" : "No"; 
        elemEV.textContent = evText; 
        elemEV.setAttribute("ev", evText); 

        document.getElementById("ssleuth-text-cert-org").textContent = cert.organization;
        document.getElementById("ssleuth-text-cert-org-unit").textContent = cert.organizationalUnit;
        document.getElementById("ssleuth-text-cert-issuer-org").textContent = cert.issuerOrganization; 
        document.getElementById("ssleuth-text-cert-issuer-org-unit").textContent = cert.issuerOrganizationUnit; 

        var certValidity = document.getElementById("ssleuth-text-cert-validity"); 
        var certValid = (ssleuth.isCertValid(cert)? "true" : "false"); 
        certValidity.setAttribute("valid", certValid); 
        certValidity.textContent = validity.notBeforeGMT + " till " + validity.notAfterGMT;

        var domainMatched = document.getElementById("ssleuth-text-cert-domain-matched"); 
        var domMatchText = (!domMismatch)? "Yes" : "No"; 
        domainMatched.textContent = domMatchText; 
        domainMatched.setAttribute("match", domMatchText); 

        if (certValid == "true" && domMatchText == "Yes" ) {
            document.getElementById("ssleuth-img-cert-state").setAttribute("state", "good"); 
        } else {
            document.getElementById("ssleuth-img-cert-state").setAttribute("state", "bad"); 
        }
    }, 
     
    openPreferences : function(index) {
            const Cc = Components.classes;
            const Ci = Components.interfaces;
            let application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);

        if (null == this.prefsWindow || this.prefsWindow.closed) {
            let instantApply =
                application.prefs.get("browser.preferences.instantApply");
            let features =
                "chrome,titlebar,toolbar,centerscreen" +
                (instantApply.value ? ",dialog=no" : ",modal");
            this.prefsWindow =
                window.openDialog(
                "chrome://ssleuth/content/preferences.xul",
                "ssleuth-preferences-window", features, 
                {tabIndex: index});
        }
        this.prefsWindow.focus();
    },
    reloadPreferences: function() {
            /* This doesn't work, installButton should be robust*/

            /* Read preferences here */
            const prefs = 
                Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
            this.ssleuthBtnLocation = prefs.getIntPref("extensions.ssleuth.notifier.location"); 

            /* Set button location */
            this.ssleuthInstallButton(this.ssleuthBtnLocation); 
            this.setButtonRank(-1);
    },
 
};

window.addEventListener("load", function() { ssleuth.init() }, false);
window.addEventListener("unload", function() { ssleuth.uninit() }, false);
