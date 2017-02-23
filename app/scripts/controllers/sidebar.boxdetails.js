'use strict';

angular.module('openSenseMapApp')
	.controller('SidebarBoxDetailsCtrl',
		['$scope', '$stateParams', '$http', 'OpenSenseBox', 'OpenSenseBoxesSensors', 'OpenSenseBoxAPI', 'Validation', 'ngDialog', '$timeout', 'OpenSenseBoxData', function($scope, $stateParams, $http, OpenSenseBox, OpenSenseBoxesSensors, OpenSenseBoxAPI, Validation, ngDialog, $timeout, OpenSenseBoxData){

		$scope.osemapi = OpenSenseBoxAPI;
		$scope.true = true;
		$scope.prom;
		$scope.delay = 60000;

		var getMeasurements = function () {
			$scope.prom = $timeout(getMeasurements, $scope.delay);
			OpenSenseBoxesSensors.query({ boxId: $stateParams.id }, function(response) {
				if ($scope.selectedMarkerData === undefined) {
					$scope.selectedMarkerData = response;
				} else {
					$scope.selectedMarkerData.sensors.map(function (value) {
						for (var i = 0; i < response.sensors.length; i++) {
							if (value._id === response.sensors[i]._id && value.lastMeasurement !== undefined) {
								angular.extend(value.lastMeasurement, response.sensors[i].lastMeasurement);
								// add the last Measurement to the chartData
								var d = new Date(response.sensors[i].lastMeasurement.createdAt);
								var val = parseFloat(response.sensors[i].lastMeasurement.value);
								var dataPair = { "date": "", "value": null};
								dataPair.date = d;
								dataPair.value = val;
								// only add the value when the chart is already enabled
								if ($scope.chartData[response.sensors[i]._id] !== undefined){
									$scope.chartData[response.sensors[i]._id].push(dataPair);
								}
							}
						}
					});
				}
			});
		};

		OpenSenseBox.query({ boxId: $stateParams.id }, function(response){
			var markerLatLng = [
				response.loc[0].geometry.coordinates[1],
				response.loc[0].geometry.coordinates[0]
			];
			$scope.$parent.centerLatLng(markerLatLng);
			$scope.selectedMarker = response;
			getMeasurements();
		}, function(){
			$scope.boxNotFound = true;
		});

		$scope.closeSidebar = function () {
			$timeout.cancel($scope.prom);
		};

		$scope.openEditDialog = function () {
			$scope.launchTemp = ngDialog.open({
				template: '/views/editbox.html',
				className: 'ngdialog-theme-default',
				scope: $scope,
				showClose: true,
				closeByDocument: false,
				controller: 'EditboxCtrl'
			});
		};

 		$scope.getBadgeColor = function (exposure) {
      		if (exposure === 'indoor') {
        		return 'orange';
      		} else {
        		return 'olive';
      		}
    	};

		$scope.getIcon = function(sensor) {
			if (sensor.icon !== undefined) {
				return sensor.icon;
			} else {
				if ((sensor.sensorType === 'HDC1008' || sensor.sensorType === 'DHT11')  && sensor.title === 'Temperatur') {
					return 'osem-thermometer';
				} else if (sensor.sensorType === 'HDC1008' || sensor.title === 'rel. Luftfeuchte' || sensor.title === 'Luftfeuchtigkeit') {
					return 'osem-humidity';
				} else if (sensor.sensorType === 'LM386') {
					return 'osem-volume-up';
				} else if (sensor.sensorType === 'BMP280' && sensor.title === 'Luftdruck') {
					return 'osem-barometer';
				} else if (sensor.sensorType === 'TSL45315' || sensor.sensorType === 'VEML6070') {
					return 'osem-brightness';
				} else {
					return 'osem-dashboard';
				}
			}
		};

		/* CHARTS */
		$scope.chartData = {}; //stores data for each sensor
		$scope.chartOptions = {}; //stores chart options for each chart
		$scope.chartDone = {};
		$scope.chartError = {};
		$scope.getData = function(sensorId, panelOpen){
			if(!panelOpen) {
				return; // panel is in closing transition, don't fetch new data
			}
			var endDate = '';
			var box = $scope.selectedMarker._id;
			$scope.chartDone[sensorId] = false;
			$scope.chartError[sensorId] = false;

			// Get the date of the last taken measurement for the selected sensor
			for (var i = 0; i < $scope.selectedMarkerData.sensors.length; i++){
				if(sensorId === $scope.selectedMarkerData.sensors[i]._id){
					var title = $scope.selectedMarkerData.sensors[i].title.toString().replace('.','');

					$scope.chartData[sensorId] = [];

					if(!$scope.selectedMarkerData.sensors[i].lastMeasurement) {
						continue;
					}
					endDate = $scope.selectedMarkerData.sensors[i].lastMeasurement.createdAt;

					//get the data to display it in the graph
					OpenSenseBoxData.query({boxId:box, sensorId: sensorId, date1: '', date2: endDate})
					.$promise.then(function(response){
						for (var j = 0; j < response.length; j++){
							var d = new Date(response[j].createdAt);
							var val = parseFloat(response[j].value);
							var dataPair = { "date": "", "value": null};
							dataPair.date = d;
							dataPair.value = val;
							$scope.chartData[sensorId].push(dataPair);
						}

						//initialize chart options
						$scope.chartOptions[sensorId] = {
        					data: {"date":"2015-01-01","value":1},
							width: 350,
  							height: 280,
        					x_accessor:'date',
        					y_accessor:'value',
							target: "#chart" + sensorId, //set the right chart id containing sersorID
							area: false //blue area under line in chart
						};

						$scope.chartOptions[sensorId].data = $scope.chartData[sensorId]; //set data in chart options to sensor data
						$scope.chartDone[sensorId] = true;	
						/*$timeout(function(){
							//zooming and paning
							if ($scope.chartData[sensorId] !== undefined){
								$scope.panZoom(sensorId);
							}	
						}, 3000);	*/			
					}, function(){
						$scope.chartError[sensorId] = true;
						$scope.chartDone[sensorId] = true;
					});
				}
			}
		};

		/*var x, y, g, area, xAxis, yAxis;
		$scope.panZoom = function(sensorId){

			if ($scope.chartData[sensorId] !== undefined){
				var chartID = "#chart" + sensorId;
				var svg = d3.select(chartID),
					margin = {top: 20, right: 20, bottom: 30, left: 40},
					width = +svg.attr("width") - margin.left - margin.right,
					height = +svg.attr("height") - margin.top - margin.bottom;

				var parseDate = d3.timeParse("%b %Y");
				//var parseDate = d3.time.format('%Y-%m-%d');

				//var x = d3.time.scale().range([0, width]),
				//	y = d3.scale.linear().range([height, 0]);

				 x = d3.scaleTime().range([0, width]),
					y = d3.scaleLinear().range([height, 0]);

				 xAxis = d3.axisBottom(x),
					yAxis = d3.axisLeft(y);

				var zoom = d3.zoom()
					.scaleExtent([1, 32])
					.translateExtent([[0, 0], [width, height]])
					.extent([[0, 0], [width, height]])
					.on("zoom", zoomed);

				 area = d3.area()
					.curve(d3.curveMonotoneX)
					.x(function(d) { return x(d.date); })
					.y0(height)
					.y1(function(d) { return y(d.price); });

				svg.append("defs").append("clipPath")
					.attr("id", "clip")
					.append("rect")
					.attr("width", width)
					.attr("height", height);

				 g = svg.append("g")
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

				svg.call(zoom);

				x.domain(d3.extent($scope.chartData[sensorId], function(d) { return d.date; }));
				y.domain([0, d3.max($scope.chartData[sensorId], function(d) { return d.value; })]);

				g.append("path")
					.datum($scope.chartData[sensorId])
					.attr("class", ".mg-main-area.mg-area1.mg-area1-color")
					.attr("d", area);

				g.append("g")
					.attr("class", ".mg-x-axis")
					.attr("transform", "translate(0," + height + ")")
					.call(xAxis);

				g.append("g")
					.attr("class", ".mg-y-axis")
					.call(yAxis);

				/*d3.csv("data.csv", type, function(error, data) {
					if (error) throw error;

				

				g.append("path")
					.datum(data)
					.attr("class", "area")
					.attr("d", area);

				g.append("g")
					.attr("class", "axis axis--x")
					.attr("transform", "translate(0," + height + ")")
					.call(xAxis);

				g.append("g")
					.attr("class", "axis axis--y")
					.call(yAxis);

				var d0 = new Date(2003, 0, 1),
					d1 = new Date(2004, 0, 1);

				// Gratuitous intro zoom!
				// svg.call(zoom).transition()
				// 		.duration(1500)
				// 		.call(zoom.transform, d3.zoomIdentity
				// 				.scale(width / (x(d1) - x(d0)))
					// 				.translate(-x(d0), 0));
					svg.call(zoom);
				});*/
			/*}
		}

		function zoomed() {
			var t = d3.event.transform, xt = t.rescaleX(x), yt = t.rescaleY(y);
			console.log(t);
			if (t.x === 0) {
				console.log("END");
			}
			g.select(".mg-main-area.mg-area1.mg-area1-color").attr("d", area.x(function(d) { return xt(d.date); }));
			// g.select(".area").attr("d", area.y(function(d) { return yt(d.price); }));
			g.select(".mg-x-axis").call(xAxis.scale(xt));
			// g.select(".axis--y").call(yAxis.scale(yt));
		}

		function type(d) {
			d.date = parseDate(d.date);
			d.price = +d.price;
			return d;
		}

		$scope.formatDate = function(input){
			return d3.time.format('%Y-%m-%d')(new Date(input));
		};
		$scope.formatDateFull = function(input){
			return d3.time.format('%Y-%m-%d %H:%M:%S')(new Date(input));
		};*/

		
}]);
