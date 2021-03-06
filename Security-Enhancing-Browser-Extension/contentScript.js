
let FormTypeEnum = {
	LOGIN: 1,
	SIGNUP: 2,
	UNKOWN: 3
	//Can be extended with RESET form
}

let PasswordStatusEnum = {
	UNVERIFIED: "UNVERIFIED",
	VERIFIED: "VERIFIED"
}

let buttonSelector = 'input[type=\'submit\'], button[type=\'submit\'], input[type=\'button\']';
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
  	return window.crypto.subtle.digest('SHA-256', data);
}

function storeUrlAndPassword(url, password) 
{
	chrome.storage.local.get({ enigmaPlugin: []}, function (result) {
		let enigmaPlugin = result.enigmaPlugin;
		enigmaPlugin.push({url: url, password: password, storeTime: Date.now(), status: PasswordStatusEnum.UNVERIFIED});
		
		chrome.storage.local.set({enigmaPlugin: enigmaPlugin}, function () {
			console.log("Setting the unverified password");
		});
	});
}

async function isPasswordValid()
{
	flag = 0;
	let closestFormElement = this.closest('form');
	if(!closestFormElement) {
		console.log("There's no form element on this page. Cannot determine form type");
		return;
	}

	let passwordElem = closestFormElement.querySelector("input[type=\'password\']");
	if (passwordElem)
	{
		let url = window.location.host;
		let password = passwordElem.value;
		let event = window.event;
		const digestValue = await getMessageHash(password);
		console.log(digestValue);

		let hash = hexString(digestValue);
		let result = window.result;

		if(!result || !result.enigmaPlugin) {
			console.log('No content in chrome storage for enigma extension');
			return;
		}
		
  		let len = result.enigmaPlugin.length;
		for(i = 0; i < len; i++) 
		{
			if(result.enigmaPlugin[i].status === PasswordStatusEnum.VERIFIED && result.enigmaPlugin[i].password === hash && result.enigmaPlugin[i].url != url)
			{
				swal("Planning to submit? You are still reusing a password which was used on a different website. Clearing the password!");
				passwordElem.value = '';
				flag = 1;
			}
		}
	}

	// return flag;
}

async function interceptSubmitAction() 
{
	let formElement = this.closest('form');
	if(!formElement) {
		console.log("There's no form element on this page. Cannot determine form type");
		return;
	}

	let passwordElem = formElement.querySelector("input[type=\'password\']");
	let url = window.location.host;
	const digestValue = await getMessageHash(passwordElem.value);
	let hash = hexString(digestValue);
	storeUrlAndPassword(url, hash);
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
					swal("You are using password of " +result.enigmaPlugin[i].url+ " on " + url + ". Make sure you are on the correct website");
				}
				else {
					swal("You are reusing a password which was used on a different website. Please choose a different one.");
				}
				
			}
		}
	});
}

function getNextButton(){
	let nextSpan = document.evaluate("//span[contains(., 'Next')]", document, null, XPathResult.ANY_TYPE, null );
	let next = nextSpan.iterateNext();
	return next;
}

/************** Rules to determine the form type ******************/
function getFormTypeBySubmitButtonText(formElement)
{
	let buttonInFormEl = formElement.querySelector(buttonSelector);
	let text = ""; 
	if(!buttonInFormEl) {
		let next = getNextButton();
		if(next){
			text = next.innerText;
		}else{
			console.log("Submit button not part of the form and span element not found");
		}

	}else {
		text = buttonInFormEl.value + buttonInFormEl.innerText;
	}

	if(text === ""){
		return FormTypeEnum.UNKOWN;
	}
	let logInText = ["log in", "sign in"];
	for(let i=0; i < logInText.length; i++) {
		let index = text.toLowerCase().indexOf(logInText[i]);
		if(index != -1) {
			return FormTypeEnum.LOGIN;
		}
	}
	
	let signUpText = ["sign up", "create", "join", "register", "next"];
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
	if(!formElement) {
		console.log("There's no form element on this page. Cannot determine form type");
		return;
	}

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

	if(!closestFormElement) {
		console.log("There's no form element on this page. No submit event listener attached");
		return;
	}

	let submitBtn = closestFormElement.querySelector(buttonSelector);
	if(!submitBtn) {
		let text = "";
		let next = getNextButton();
		if(next){
			text = next.innerText;
			if(text && text.toLowerCase() === "next"){
				submitBtn = next;
			}
		}else{
			console.log("Submit Button not in the form and not a span element");
		}
	}	
	if(submitBtn && !submitBtn.onclick) {
		submitBtn.onclick = interceptSubmitAction;
		submitBtn.onmouseover = isPasswordValid;
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



 //chrome.storage.local.clear(function() {
 //});


//$.get(chrome.extension.getURL("modal.html"), function(data) {
	//	$(data).appendTo('body');
//});








