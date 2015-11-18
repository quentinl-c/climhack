var express = require('express');
var process = require('process');
var port = process.env.PORT || 1337;
var app = express();
var http = require('http').Server(app);
var json = require('json-file');
var events = require('events');
var ejs = require('ejs');

var result = null;
var ready = false;
var rank = 0;

/*
* Colors defintion
*/
var minColorCO2 = {
	r: 255,
	g: 255,
	b: 255,
	a: 0.5
};

var maxColorCO2 = {
	r: 255,
	g: 20,
	b: 147,
	a: 0.5
};

var minColorDemo = {
	r: 255,
	g: 192,
	b: 203,
	a: 0.5
};

var maxColorDemo = {
	r: 255,
	g: 0,
	b: 0,
	a: 0.5
};

var minColorWood = {
	r: 127,
	g: 255,
	b: 0,
	a: 0.2
};

var maxColorWood = {
	r: 0,
	g: 100,
	b: 0,
	a: 0.7
};

var minColorElec = {
	r: 255,
	g: 228,
	b: 145,
	a: 0.5
};

var maxColorElec = {
	r: 255,
	g: 173,
	b: 0,
	a: 0.5
};

var minColorGN = {
	r: 135,
	g: 206,
	b: 250,
	a: 0.2
};

var maxColorGN = {
	r: 255,
	g: 0,
	b: 0,
	a: 0.6
};

var minColorGPL = {
	r: 120,
	g: 220,
	b: 100,
	a: 0.5
};

var maxColorGPL = {
	r: 0,
	g: 145,
	b: 200,
	a: 0.8
};

var minColorFuel = {
	r: 193,
	g: 205,
	b: 205,
	a: 0.4
};

var maxColorFuel = {
	r: 0,
	g: 0,
	b: 0,
	a: 0.7
};

var minColorDH = {
	r: 250,
	g: 210,
	b: 130,
	a: 0.5
};

var maxColorDH = {
	r: 255,
	g: 130,
	b: 0,
	a: 0.5
};

/*
*Files reading
*/

var conso = json.read('./data/conso.json');
var work = json.read('./data/trav.json');
var jsonShapes = json.read('./data/shapes.json');

/*
*Server
*/

app.use("/assets", express.static(__dirname + '/assets'));
app.use("/views", express.static(__dirname + '/views'));

http.listen(port, function(){
	process();
	console.log('listening on *:3000');
});


/*
*Routing
*/

app.get('/api', function (req, res){
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('charset', 'utf-8')
	if(ready){
	    res.status(200).jsonp(result);
	}else{
		res.send(JSON.stringify({ error: "Service not available ..." }));
	}
});

app.get('/', function (req, res){
	res.render('index.ejs');
});

/*
Objects
*/

var JsonRes = function() {
	this.districts_shapes = [];
	this.display_modes = [];
	this.pois = [];
};

JsonRes.prototype.__proto__ = events.EventEmitter.prototype;


JsonRes.prototype.appendShape = function(district_shapes){
	this.districts_shapes.push(district_shapes);
};

JsonRes.prototype.appendDispMode = function(disp_mode){
	this.display_modes.push(disp_mode);
};

JsonRes.prototype.appendPois = function(poi){
	this.pois.push(poi);
};


var DispMod = function(nw_name, nw_minColor, nw_maxColor){
	this.name = nw_name;
	this.districts_values_min_color = nw_minColor;
	this.districts_values_max_color = nw_maxColor;
	this.chiant = false;
	this.districts_values = [];
}

DispMod.prototype.appendDistVal = function(dist_val){
	this.districts_values.push(dist_val);
}

var DistrictShape = function(nw_rank, nw_city, nw_name){
	this.id = nw_rank;
	this.city = nw_city;
	this.district = nw_name;
	this.geometry = null;
};

var DistrictValue = function(nw_id, nw_value, nw_infobubble){
	this.id = nw_id;
	this.value = nw_value;
	this.infobubble = nw_infobubble;

}

var PointOfInterest = function(nw_type, nw_infobubble, nw_lat, nw_long, nw_big){
	this.type = nw_type;
	this.infobubble = nw_infobubble;
	this.lat = nw_lat;
	this.lon = nw_long;
	this.big = nw_big;
};

/*
* Uitls
*/
var process = function(){

	result = new JsonRes();
	
	//Display modes definition

	var co2PerHabDispMode = new DispMod("CO2 par habitant", minColorCO2, maxColorCO2);	
	var demoDispMode = new DispMod("Nombre d'habitations", minColorDemo, maxColorDemo);
	var woodDispMode = new DispMod("Taux d'utilisation du chauffage au bois", minColorWood, maxColorWood);
	woodDispMode.chiant = true;
	var fuelDispMode = new DispMod("Taux d'utilisation du chauffage au fioul", minColorFuel, maxColorFuel);
	var distHDispMode = new DispMod("Taux d'utilisation du chauffage urbain", minColorDH, maxColorDH);
	distHDispMode.chiant = true;
	var gnDispMode = new DispMod("Taux d'utilisation du chauffage au gaz naturel", minColorGN, maxColorGN);
	var gplDispMode = new DispMod("Taux d'utilisation du chauffage au GPL", minColorGPL, maxColorGPL);
	gplDispMode.chiant = true;
	var elecDispMode = new DispMod("Taux d'utilisation du chauffage électrique", minColorElec, maxColorElec);

	conso.data.forEach(function(element){
		var irisName = element["Nom de le l'ilôt IRIS"];
		var city = element.Commune.substring(1, element.Commune.length);
		var totalHousing = housingSum(element);
		
		var distShape = new DistrictShape(rank, city, irisName);
		var mainInfoBub = mainInfoBubble(element, totalHousing);
		var co2DistVal = new DistrictValue(rank, parseFloat(element["Par logement (TeqCo2/logt)"]), mainInfoBub);
		var demoDistVal = new DistrictValue(rank, totalHousing, '<h2>' + irisName + ' : ' + totalHousing+  ' habitants</h2>');
		var fuelDistVal = new DistrictValue(rank, parseInt(element["Fioul lgmt"])/totalHousing, '<h2>' + irisName + ' : ' + Math.round(parseInt(element["Fioul lgmt"])/totalHousing*10000)/10000 + ' % des foyers utilisent le chauffage au fioul</h2>');
		var wooDistVal = new DistrictValue(rank, parseInt(element["Bois lgmt"])/totalHousing, '<h2>' + irisName + ' : ' +  Math.round(parseInt(element["Bois lgmt"])/totalHousing*10000)/10000 + ' % des foyers utilisent le chauffage au bois</h2>' );
		var distHDistVal = new DistrictValue(rank, parseInt(element["Chauffage urbain lgmt"])/totalHousing, '<h2>' + irisName + ' : ' + Math.round(parseInt(element["Chauffage urbain lgmt"])/totalHousing*10000)/10000 + ' % des foyers utilisent le chauffage urbain</h2>');
		var gnDistVal = new DistrictValue(rank, parseInt(element["Gaz naturel lgmt"])/totalHousing, '<h2>' + irisName + ' : ' +  Math.round(parseInt(element["Gaz naturel lgmt"])/totalHousing*10000)/10000 + ' % des foyers utilisent le chauffage au gaz naturel</h2>');
		var gplDistVal = new DistrictValue(rank, parseInt(element["GPL lgmt"])/totalHousing, '<h2>' + irisName + ' : ' + Math.round(parseInt(element["GPL lgmt"])/totalHousing*10000)/10000 + ' % des foyers utilisent le chauffage au GPL</h2>' );
		var elecDistVal = new DistrictValue(rank, parseInt(element["Electricité lgmt"])/totalHousing, '<h2>' + irisName + ' : '+ Math.round(parseInt(element["Electricité lgmt"])/totalHousing*10000)/10000 + ' % des foyers utilisent le chauffage électrique</h2>' );


		jsonShapes.data.features.forEach(function(elt){
			if(elt.properties['NOM_IRIS'] === irisName && elt.properties["NOM_COM"] === city){
				distShape.geometry = elt.geometry;
			}
		});

		result.appendShape(distShape);

		co2PerHabDispMode.appendDistVal(co2DistVal);
		demoDispMode.appendDistVal(demoDistVal);
		woodDispMode.appendDistVal(wooDistVal);
		fuelDispMode.appendDistVal(fuelDistVal);
		distHDispMode.appendDistVal(distHDistVal);
		gnDispMode.appendDistVal(gnDistVal);
		gplDispMode.appendDistVal(gplDistVal);
		elecDispMode.appendDistVal(elecDistVal);

		rank ++;
	});
	result.appendDispMode(co2PerHabDispMode);
	result.appendDispMode(demoDispMode);
	result.appendDispMode(woodDispMode);
	result.appendDispMode(fuelDispMode);
	result.appendDispMode(distHDispMode);
	result.appendDispMode(gnDispMode);
	result.appendDispMode(gplDispMode);
	result.appendDispMode(elecDispMode);
	// result.emit('ready');
	
	/*
	*POIs
	*/

	//aray sorting 
	work.data.sort(function(a,b){
		return parseInt(b["INVESTISSEMENT"]) - parseInt(a["INVESTISSEMENT"]);
	});

	work.data.forEach(function(elt){

	});

	/*
	*Selector
	*/

	var heat = []; //Chauffagev type 0
	var iso = [];//Isolation type 1
	
	work.data.forEach(function(elt){
		if(elt["TRAVAUX"] === "Chauffage"){
			heat.push(elt);
		}else{
			iso.push(elt);
		}
	});

	heat.sort(sortFunction);
	iso.sort(sortFunction);
	var rk = 0;
	heat.forEach(function(elt){
		var big = false;
		if(rk < 5){
			big = true;
			rk ++;
		}
		var infobubble = '<h2>' + elt["TYPE TRAVAUX"] + '</h2>'+
		'<ul>'+
		'<li>Investissement : ' + elt["INVESTISSEMENT"] + ' €</li>'+
		'<li>KWatt/h économisés : ' + elt["KWH ECONOMISES"] + ' kWatt/h</li>'+
		'<li>Kg CO2 évités : ' + elt["KG CO2 EVITES"] + ' kg CO2</li>'+
		'<li>Apport financier du Grand Nancy : ' + elt["AIDE FINANCIERE"] + ' €</li>'+
		'</ul>';
		var poi = new PointOfInterest(0, infobubble, parseFloat(elt["LAT"]), parseFloat(elt["LNG"]), big);
		result.appendPois(poi);
	});
	rk=0;
	iso.forEach(function(elt){
		var big = false;
		if(rk < 5){
			big = true;
			rk ++;
		}
		var infobubble = '<h2>' + elt["TYPE TRAVAUX"] + '</h2>'+
		'<ul>'+
		'<li>Investissement : ' + elt["INVESTISSEMENT"] + ' €</li>'+
		'<li>KWatt/h économisés : ' + elt["KWH ECONOMISES"] + ' kWatt/h</li>'+
		'<li>Kg CO2 évités : ' + elt["KG CO2 EVITES"] + ' kg CO2</li>'+
		'<li>Apport financier du Grand Nancy : ' + elt["AIDE FINANCIERE"] + ' €</li>'+
		'</ul>';
		var poi = new PointOfInterest(1, infobubble, parseFloat(elt["LAT"]), parseFloat(elt["LNG"]), big);
		result.appendPois(poi);
	});
	
	ready = true;
	
};

var housingSum = function(elt){
	return parseInt(elt["Bois lgmt"]) + parseInt(elt["Chauffage urbain lgmt"]) + parseInt(elt["Electricité lgmt"]) + parseInt(elt["Fioul lgmt"]) + parseInt(elt["Gaz naturel lgmt"]) + parseInt(elt["GPL lgmt"]);
};

var sortFunction = function(a,b){
	var firstArg = ((parseInt(a["INVESTISSEMENT"])  - parseInt(a["AIDE FINANCIERE"]))/parseInt(a["KG CO2 EVITES"])) + 7.7*((parseInt(a["INVESTISSEMENT"])  - parseInt(a["AIDE FINANCIERE"]))/parseInt(a["KWH ECONOMISES"]));
	var secArg = ((parseInt(b["INVESTISSEMENT"])  - parseInt(b["AIDE FINANCIERE"]))/parseInt(b["KG CO2 EVITES"])) + 7.7*((parseInt(b["INVESTISSEMENT"])  - parseInt(b["AIDE FINANCIERE"]))/parseInt(b["KWH ECONOMISES"]));
	a.toto = firstArg;
	b.toto = secArg;
	return firstArg - secArg;
};

var mainInfoBubble = function(element, totalHousing){
	var perCentFuel = parseInt(element["Fioul lgmt"])/totalHousing * 100;
	var perCentWood = parseInt(element["Bois lgmt"])/totalHousing * 100;
	var perCentDH = parseInt(element["Chauffage urbain lgmt"])/totalHousing * 100;
	var perCentGN = parseInt(element["Gaz naturel lgmt"])/totalHousing * 100;
	var perCentGPL = parseInt(element["GPL lgmt"])/totalHousing * 100;
	var perCentElec = parseInt(element["Electricité lgmt"])/totalHousing * 100;
	var bubble = '<h2>' + element["Nom de le l'ilôt IRIS"] + '</h2>'+
	'<img src="https://chart.googleapis.com/chart?cht=p3&chs=600x250&chd=t:' + perCentWood + ',' + perCentDH + ',' + perCentElec +',' + perCentFuel + ',' + perCentGN + ',' + perCentGPL + '&chl=Bois|ChaufUrb|Elec|Fioul|Gaz|GPL" alt/>';
	return bubble;
};
/*
* Events
*/

// result.on('ready', function(){
// 	console.log('ready');
// 	ready = true;
// });


