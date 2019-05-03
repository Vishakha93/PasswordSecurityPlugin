
let FormTypeEnum = {
	LOGIN: 1,
	SIGNUP: 2,
	UNKOWN: 3
	//Can be extended with RESET form
}

let PasswordStatusEnum = {
	UNVERIFIED: 1,
	VERIFIED: 2
}
/*
Problems with enigma plugin

Does not work in the following cases
1. Password field is hidden. Ex - Yahoo
2. Button mentions “Next”/“Continue” - Form Type is Unknown. Ex - Gmail/LinkedIn
3. Document loads dynamically so difficult to add handler on password input Ex - Instagram
4. Document has multiple forms. Ex - Facebook

*/

/* Logic to store hash of the password */
function hexString(buffer) 
{
	const byteArray = new Uint8Array(buffer);

  	const hexCodes = [...byteArray].map(value => {
    const hexCode = value.toString(16);
    const paddedHexCode = hexCode.padStart(2, '0');
    	return paddedHexCode;
  	});

  	return hexCodes.join('');
}

function getMessageHash(message) 
{
  	const encoder = new TextEncoder();
  	const data = encoder.encode(message);
  	return window.crypto.subtle.digest('SHA-512', data);
}

function storeUrlAndPassword(url, password) 
{
	chrome.storage.local.get({ enigmaPlugin: []}, function (result) {
		let enigmaPlugin = result.enigmaPlugin;

		let verifiedPasswordExists = enigmaPlugin.filter(urlPassword => (urlPassword.url === url && urlPassword.status === PasswordStatusEnum.VERIFIED));

		if (verifiedPasswordExists && verifiedPasswordExists.length > 0) {
			return;
		}


		enigmaPlugin = enigmaPlugin.filter(urlPassword => (urlPassword.url != url));
		enigmaPlugin.push({url: url, password: password, storeTime: Date.now(), status: PasswordStatusEnum.UNVERIFIED});
		
		chrome.storage.local.set({enigmaPlugin: enigmaPlugin}, function () {
			chrome.storage.local.get('enigmaPlugin', function (result2) {

				alert(JSON.stringify(result2.enigmaPlugin));
				//document.getElementById("modalHeader").innerHTML = "Password Reuse Warning";
				//document.getElementById("modalBody").innerHTML = "<h2>You reused a password</h2><h2>Please fix</h2><<h2>Please fix</h2>";
				//document.getElementById("myBtn").click();

			});
		});
	});
}

async function isPasswordValid(passwordElem)
{
	flag = 0;
	if (passwordElem)
	{
		let url = window.location.host;
		let password = passwordElem.value;
		let event = window.event;
		const digestValue = await getMessageHash(password);
		console.log(digestValue);
		// getMessageHash(password).then(digestValue => {
		let hash = hexString(digestValue);
		window.url = url;
		window.hash = hash;
		let result = window.result;
  		let len = result.enigmaPlugin.length;
		for(i = 0; i < len; i++) 
		{
			if(result.enigmaPlugin[i].password === hash && result.enigmaPlugin[i].url != url)
			{
				alert("You are still using password of " +result.enigmaPlugin[i].url+ ". Please choose a different password to continue");
				flag = 1;
			}
		}
	}

	return flag;
}

async function interceptSubmitAction() 
{
	let form = this.closest('form');
	let passwordElem = form.querySelector("input[type=\'password\']");
	flag = await isPasswordValid(passwordElem);
	if(!flag)
		storeUrlAndPassword(window.url, window.hash);
	else
			form.submit(false);
}

function comparePasswords(result, password, formType)
{
	getMessageHash(password).then(digestValue => {

		let hash = hexString(digestValue);
		let url = window.location.host;
		let len = result.enigmaPlugin.length;
		for(let i = 0; i < len; i++) {
			if(result.enigmaPlugin[i].status === PasswordStatusEnum.VERIFIED && result.enigmaPlugin[i].password === hash && result.enigmaPlugin[i].url != url) {

				if(formType === FormTypeEnum.LOGIN) {
					alert("You are using password of " +result.enigmaPlugin[i].url+ " on " + url);
				}
				else {
					alert("This is the password of " + result.enigmaPlugin[i].url + " website. Please choose a different password.");
				}
				
			}
		}
	});
}

/************** Rules to determine the form type ******************/
function getFormTypeBySubmitButtonText(formElement)
{
	let buttonInFormEl = formElement.querySelector('input[type=\'submit\'], button[type=\'submit\']');
	let text = buttonInFormEl.value + buttonInFormEl.innerText;
	let logInText = ["log in", "sign in"];
	for(let i=0; i < logInText.length; i++) {
		let index = text.toLowerCase().indexOf(logInText[i]);
		if(index != -1) {
			return FormTypeEnum.LOGIN;
		}
	}
	
	let signUpText = ["sign up", "create", "join"];
	let signUpScore = 0;

	for(let i=0; i < signUpText.length; i++) {
		let index = text.toLowerCase().indexOf(signUpText[i]);
		if(index != -1) {
			return FormTypeEnum.SIGNUP;
		}
	}

	return FormTypeEnum.UNKOWN;
}

function getFormTypeByNoOfPasswordFields(formElement)
{
	let passwordElems = formElement.querySelectorAll('input[type=\'password\']');
	if(passwordElems.length > 1) {
		return FormTypeEnum.SIGNUP;
	}

	return FormTypeEnum.UNKOWN;
}

function getFormTypeByNoOfInputFields(formElement)
{
	let inputElems = formElement.querySelectorAll('input[type=\'text\'], input[type=\'email\']');
	if(inputElems.length > 1) {
		return FormTypeEnum.SIGNUP;
	}

	return FormTypeEnum.LOGIN;
}

// Priority Algorithm
// The checks for a form being login/signup are written in order
// If first check satisfies, we don't check the other ones.
function getFormType(formElement)
{
	formType = getFormTypeBySubmitButtonText(formElement);
	if(formType != FormTypeEnum.UNKOWN)
		return formType;

	formType = getFormTypeByNoOfPasswordFields(formElement);
	if(formType != FormTypeEnum.UNKOWN)
		return formType;

	formType = getFormTypeByNoOfInputFields(formElement);
	return formType;
}


function interceptUserInput()
{
	passwordElem = this;
	if(passwordElem && passwordElem.value) {

		let closestFormElement = passwordElem.closest('form');
		let formType = getFormType(closestFormElement);

		password = passwordElem.value;
		chrome.storage.local.get({ enigmaPlugin: []}, function (result) {
			window.result = result;
			comparePasswords(result, password, formType);
		});
		
	}
}

function addSubmitEventListener(passwordElem) {

	//Only that submit button should have on-click event which belong to the password form
	let closestFormElement = passwordElem.closest('form');
	let submitBtn = closestFormElement.querySelector('input[type=\'submit\'], button[type=\'submit\']');
	if(submitBtn && !submitBtn.onclick) {
		submitBtn.onclick = interceptSubmitAction;
	}
}



function addListenerOnPasswordAndSubmitElements(passwordElem) {
	if(passwordElem && !passwordElem.oninput) {
		passwordElem.oninput = interceptUserInput;
		addSubmitEventListener(passwordElem);
	}
}
//TODO: Many webpages show the login/signup forms dynamically. The form is not there when page loads.
//It gets added after some times
//Ex. Instagram
/*window.addEventListener('load',function(){
	addListenerOnPasswordAndSubmitElements();
});*/


document.addEventListener("input", function(event){
	console.log(event.target.type);
	if(event.target.type === 'password') {
		addListenerOnPasswordAndSubmitElements(event.target);
	}
});

/************** Alexa-10k support ******************/

function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];
    console.log(hostname);
    hostname = hostname.replace('www.','');
    console.log(hostname);
    return hostname;
}

function storeUrl(url)
{
	chrome.storage.local.get({ enigmaExtension_urls: []}, function (result) {
		let whitelist = result.enigmaExtension_urls;
		whitelist.push(url);
		let url_set = new Set(whitelist);
		whitelist = [...url_set];
		
		chrome.storage.local.set({'enigmaExtension_urls': whitelist}, function () {
			chrome.storage.local.get('enigmaExtension_urls', function (result2) {
				alert(result2.enigmaExtension_urls);
			});

		});
	});
}

function matchHostnames(hostname, domain)
{
	if (hostname.endsWith(domain))
		return true;
	else
		return false;
}

function interceptClickEvent(json) 
{
	var anchors = document.getElementsByTagName("a");
	var filename = "alexa_10k.json";
	chrome.storage.local.get({ enigmaExtension_urls: []}, function (result) {
		var whitelist = result.enigmaExtension_urls;
		for (var i = 0, length = anchors.length; i < length; i++) {
		  	var anchor = anchors[i];
		  	var hostname;
		  	var size;
		  	anchor.addEventListener('click', function(event) {
		    	// `this` refers to the anchor tag that's been clicked
		    	hostname = extractHostname(this.href);
		    	flag = 1;
		    	size = Object.keys(json).length;
		    	for(var j = 0; j < size; j++)
		    	{
		    		if(matchHostnames(hostname, json[j]))
		    			flag = 0;
		    	}
		    	// check if hostname is present in whitelist  
		    	if (flag && whitelist != null)
		    	{
		    		for(var k = 0; k < whitelist.length; k++)
		    		{
		    			if(matchHostnames(hostname, whitelist[k]))
		    				flag = 0;		
		    		}
		    	}
		    	if (flag)
		    	{
		    		if (confirm(hostname + " doesn't belong to Alexa 10k websites!!!\nContinue to website?"))
		    		{
		    			if (confirm("Add " + hostname + " to list of safe sites?"))
		    			{
							storeUrl(hostname);
		    			}
		    		}
		    		else
		    		{
			    		event.preventDefault();
		    		}
		    	}
	    		// Log the clicked element in the console
				console.log(event.target);
		  	}, true);
		};
	});
}

const url = chrome.runtime.getURL('alexa_10k.json');

fetch(url)
    .then((response) => response.json()) //assuming file contains json
    .then((json) => interceptClickEvent(json));


 //chrome.storage.local.clear(function() {
 //});


//$.get(chrome.extension.getURL("modal.html"), function(data) {
	//	$(data).appendTo('body');
//});








