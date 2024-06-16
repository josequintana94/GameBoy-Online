"use strict";
var gameboy = null;						//GameBoyCore object.
var gbRunInterval = null;				//GameBoyCore Timer
var settings = [						//Some settings.
	true, 								//Turn on sound.
	true,								//Boot with boot ROM first?
	false,								//Give priority to GameBoy mode
	1,									//Volume level set.
	true,								//Colorize GB mode?
	false,								//Disallow typed arrays?
	8,									//Interval for the emulator loop.
	10,									//Audio buffer minimum span amount over x interpreter iterations.
	20,									//Audio buffer maximum span amount over x interpreter iterations.
	false,								//Override to allow for MBC1 instead of ROM only (compatibility for broken 3rd-party cartridges).
	false,								//Override MBC RAM disabling and always allow reading and writing to the banks.
	false,								//Use the GameBoy boot ROM instead of the GameBoy Color boot ROM.
	false,								//Scale the canvas in JS, or let the browser scale the canvas?
	true,								//Use image smoothing based scaling?
    [true, true, true, true]            //User controlled channel enables.
];

function start(canvas, ROM) {
	clearLastEmulation();
	autoSave();	//If we are about to load a new game, then save the last one...
	gameboy = new GameBoyCore(canvas, ROM);
	gameboy.openMBC = openSRAM;
	gameboy.openRTC = openRTC;
	gameboy.start();
	run();
}

function run() {
	if (GameBoyEmulatorInitialized()) {
		if (!GameBoyEmulatorPlaying()) {
			gameboy.stopEmulator &= 1;
			cout("Starting the iterator.", 0);
			var dateObj = new Date();
			gameboy.firstIteration = dateObj.getTime();
			gameboy.iterations = 0;
			gbRunInterval = setInterval(function () {
				if (!document.hidden && !document.msHidden && !document.mozHidden && !document.webkitHidden) {
					gameboy.run();
				}
			}, settings[6]);
		}
		else {
			cout("The GameBoy core is already running.", 1);
		}
	}
	else {
		cout("GameBoy core cannot run while it has not been initialized.", 1);
	}
}

function pause() {
	if (GameBoyEmulatorInitialized()) {
		if (GameBoyEmulatorPlaying()) {
			autoSave();
			clearLastEmulation();
		}
		else {
			cout("GameBoy core has already been paused.", 1);
		}
	}
	else {
		cout("GameBoy core cannot be paused while it has not been initialized.", 1);
	}
}

function clearLastEmulation() {
	if (GameBoyEmulatorInitialized() && GameBoyEmulatorPlaying()) {
		clearInterval(gbRunInterval);
		gameboy.stopEmulator |= 2;
		cout("The previous emulation has been cleared.", 0);
	}
	else {
		cout("No previous emulation was found to be cleared.", 0);
	}
}

function save() {
	if (GameBoyEmulatorInitialized()) {
		var state_suffix = 0;
		while (findValue("FREEZE_" + gameboy.name + "_" + state_suffix) != null) {
			state_suffix++;
		}
		saveState("FREEZE_" + gameboy.name + "_" + state_suffix);
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}

function saveSRAM() {
	if (GameBoyEmulatorInitialized()) {
		if (gameboy.cBATT) {
			try {
				var sram = gameboy.saveSRAMState();
				if (sram.length > 0) {
					cout("Saving the SRAM...", 0);
					if (findValue("SRAM_" + gameboy.name) != null) {
						//Remove the outdated storage format save:
						cout("Deleting the old SRAM save due to outdated format.", 0);
						deleteValue("SRAM_" + gameboy.name);
					}
					setValue("B64_SRAM_" + gameboy.name, arrayToBase64(sram));
				}
				else {
					cout("SRAM could not be saved because it was empty.", 1);
				}
			}
			catch (error) {
				cout("Could not save the current emulation state(\"" + error.message + "\").", 2);
			}
		}
		else {
			cout("Cannot save a game that does not have battery backed SRAM specified.", 1);
		}
		saveRTC();
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}

function saveRTC() {	//Execute this when SRAM is being saved as well.
	if (GameBoyEmulatorInitialized()) {
		if (gameboy.cTIMER) {
			try {
				cout("Saving the RTC...", 0);
				setValue("RTC_" + gameboy.name, gameboy.saveRTCState());
			}
			catch (error) {
				cout("Could not save the RTC of the current emulation state(\"" + error.message + "\").", 2);
			}
		}
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}

function autoSave() {
	if (GameBoyEmulatorInitialized()) {
		cout("Automatically saving the SRAM.", 0);
		saveSRAM();
		saveRTC();
	}
}

function openSRAM(filename) {
	try {
		if (findValue("B64_SRAM_" + filename) != null) {
			cout("Found a previous SRAM state (Will attempt to load).", 0);
			return base64ToArray(findValue("B64_SRAM_" + filename));
		}
		else if (findValue("SRAM_" + filename) != null) {
			cout("Found a previous SRAM state (Will attempt to load).", 0);
			return findValue("SRAM_" + filename);
		}
		else {
			cout("Could not find any previous SRAM copy for the current ROM.", 0);
		}
	}
	catch (error) {
		cout("Could not open the  SRAM of the saved emulation state.", 2);
	}
	return [];
}

function openRTC(filename) {
	try {
		if (findValue("RTC_" + filename) != null) {
			cout("Found a previous RTC state (Will attempt to load).", 0);
			return findValue("RTC_" + filename);
		}
		else {
			cout("Could not find any previous RTC copy for the current ROM.", 0);
		}
	}
	catch (error) {
		cout("Could not open the RTC data of the saved emulation state.", 2);
	}
	return [];
}

function saveState(filename) {
	if (GameBoyEmulatorInitialized()) {
		try {
			setValue(filename, gameboy.saveState());
			cout("Saved the current state as: " + filename, 0);
		}
		catch (error) {
			cout("Could not save the current emulation state(\"" + error.message + "\").", 2);
		}
	}
	else {
		cout("GameBoy core cannot be saved while it has not been initialized.", 1);
	}
}

function openState(filename, canvas) {
	try {
		if (findValue(filename) != null) {
			try {
				clearLastEmulation();
				cout("Attempting to run a saved emulation state.", 0);
				gameboy = new GameBoyCore(canvas, "");
				gameboy.savedStateFileName = filename;
				gameboy.returnFromState(findValue(filename));
				run();
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
		else {
			cout("Could not find the save state " + filename + "\".", 2);
		}
	}
	catch (error) {
		cout("Could not open the saved emulation state.", 2);
	}
}

function import_save(blobData) {
	blobData = decodeBlob(blobData);
	if (blobData && blobData.blobs) {
		if (blobData.blobs.length > 0) {
			for (var index = 0; index < blobData.blobs.length; ++index) {
				cout("Importing blob \"" + blobData.blobs[index].blobID + "\"", 0);
				if (blobData.blobs[index].blobContent) {
					if (blobData.blobs[index].blobID.substring(0, 5) == "SRAM_") {
						setValue("B64_" + blobData.blobs[index].blobID, base64(blobData.blobs[index].blobContent));
					}
					else {
						setValue(blobData.blobs[index].blobID, JSON.parse(blobData.blobs[index].blobContent));
					}
				}
				else if (blobData.blobs[index].blobID) {
					cout("Save file imported had blob \"" + blobData.blobs[index].blobID + "\" with no blob data interpretable.", 2);
				}
				else {
					cout("Blob chunk information missing completely.", 2);
				}
			}
		}
		else {
			cout("Could not decode the imported file.", 2);
		}
	}
	else {
		cout("Could not decode the imported file.", 2);
	}
}

function export_save() {
	try {
		if (window.URL) {
			var sram = gameboy.saveSRAMState();
			var state = gameboy.saveState();
			var rtc = gameboy.saveRTCState();
			var sramBlob = "";
			var rtcBlob = "";
			var stateBlob = JSON.stringify(state);
			if (sram.length > 0) {
				sramBlob = base64(sram);
			}
			if (rtc.length > 0) {
				rtcBlob = JSON.stringify(rtc);
			}
			var encoded = "EMULATOR_STATE\n" + "B64_SRAM_" + gameboy.name + "\n" + sramBlob + "\nRTC_" + gameboy.name + "\n" + rtcBlob + "\n" + stateBlob;
			var saveLink = document.createElement("a");
			saveLink.href = window.URL.createObjectURL(new Blob([encoded], {type: "text/plain"}));
			saveLink.download = "save." + gameboy.name + ".state";
			document.body.appendChild(saveLink);
			saveLink.click();
			document.body.removeChild(saveLink);
		}
		else {
			cout("Your browser does not support saving.", 2);
		}
	}
	catch (error) {
		cout("Could not save the current emulation state(\"" + error.message + "\").", 2);
	}
}

function base64ToArray(base64String) {
	var raw = window.atob(base64String);
	var rawLength = raw.length;
	var array = new Uint8Array(new ArrayBuffer(rawLength));

	for (var i = 0; i < rawLength; i++) {
		array[i] = raw.charCodeAt(i);
	}
	return array;
}

function arrayToBase64(buffer) {
	var binary = '';
	var bytes = new Uint8Array(buffer);
	var len = bytes.byteLength;
	for (var i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

function findValue(key) {
	try {
		return window.localStorage.getItem(key);
	}
	catch (error) {
		cout("Could not retrieve a previous emulation state.", 2);
	}
	return null;
}

function setValue(key, value) {
	try {
		window.localStorage.setItem(key, value);
	}
	catch (error) {
		cout("Could not save the current emulation state(\"" + error.message + "\").", 2);
	}
}

function deleteValue(key) {
	try {
		window.localStorage.removeItem(key);
	}
	catch (error) {
		cout("Could not delete the saved emulation state(\"" + error.message + "\").", 2);
	}
}

function cout(message, severity) {
	var consoleElement = document.getElementById("console");
	if (consoleElement) {
		var lineBreak = document.createElement("br");
		var span = document.createElement("span");

		if (severity >= 3) {
			span.style.color = "red";
		}
		else if (severity == 2) {
			span.style.color = "orange";
		}
		else if (severity == 1) {
			span.style.color = "yellow";
		}
		else {
			span.style.color = "green";
		}

		span.appendChild(document.createTextNode(message));
		consoleElement.appendChild(span);
		consoleElement.appendChild(lineBreak);
	}
}

function decodeBlob(blobData) {
	try {
		return JSON.parse(atob(blobData.substring("data:application/octet-stream;base64,".length)));
	}
	catch (error) {
		cout("Could not decode the imported file.", 2);
	}
	return null;
}

function downloadFile(fileName, content) {
	var aLink = document.createElement("a");
	var blob = new Blob([content]);
	aLink.download = fileName;
	aLink.href = URL.createObjectURL(blob);
	aLink.click();
}

// Automatically load the Pokémon Red ROM
fetch('pokemon_red.gb')
    .then(response => response.arrayBuffer())
    .then(buffer => {
        start(document.getElementById("emulator_target"), buffer);
    })
    .catch(err => console.error('Failed to load ROM:', err));