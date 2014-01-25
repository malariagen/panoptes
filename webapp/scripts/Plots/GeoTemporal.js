define(["require", "DQX/base64", "DQX/Application", "DQX/DataDecoders", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/Map", "DQX/DataFetcher/DataFetchers", "Wizards/EditQuery", "DQX/GMaps/PointSet",
    "MetaData",
    "Utils/QueryTool", "Plots/GenericPlot", "Utils/TimeLineView"],
    function (require, base64, Application, DataDecoders, Framework, Controls, Msg, SQL, DocEl, DQX, Wizard, Popup, PopupFrame, Map, DataFetchers, EditQuery, PointSet,
              MetaData,
              QueryTool, GenericPlot, TimeLineView) {

        var GeoTemporal = {};




        GenericPlot.registerPlotType('GeoTemporal', GeoTemporal);







        GeoTemporal.CreateComp_TimeLine = function(thePlot) {
            var that = {};
            that.thePlot = thePlot;
            that.tableInfo = thePlot.tableInfo;

            that.createView = function() {
                that.myTimeLine = TimeLineView.Create(that.frame);
                that.myTimeLine.setOnViewPortModified(DQX.ratelimit(that.updateTimeViewPort,50));
                that.myTimeLine.setOnTimeRangeSelected(that.fetchTimeRangeSelection);
            };


            that.createControls = function() {
                var propList = [];
                $.each(MetaData.customProperties, function(idx, propInfo) {
                    if ( (propInfo.tableid == that.tableInfo.id) && (propInfo.isDate) )
                        propList.push({id:propInfo.propid, name:propInfo.name});
                });
                that.ctrlDateProperty = Controls.Combo(null,{ label:'Date:', states: propList, value:propList[0].id }).setClassID('dateprop');
                that.ctrlDateProperty.setOnChanged(function() {
                    that.fetchData();
                });

                that.ctrl_restrictToTimeViewPort = Controls.Check(null,{ label: 'Restrict to viewport'}).setClassID('restricttotimeviewport');
                that.ctrl_restrictToTimeViewPort.setOnChanged(function() {
                    if (that.ctrl_restrictToTimeViewPort.getValue())
                        that.updateTimeViewPort();
                    else {
                        that.thePlot.pointSet.setPointFilter('timeFilter', null);
                        that.thePlot.updateMapPoints();
                        that.thePlot.reDraw();
                    }
                });

                that.ctrl_showTimeBarsAsPercentage = Controls.Check(null,{ label: 'Show as percentage'}).setClassID('showtimeaspercentage');
                that.ctrl_showTimeBarsAsPercentage.setOnChanged(function() {
                    that.thePlot.reDraw();
                });

                var groupTimeControls = Controls.CompoundVert([that.ctrlDateProperty, that.ctrl_showTimeBarsAsPercentage, that.ctrl_restrictToTimeViewPort]).setLegend('<h4>Time line</h4>');


                return groupTimeControls;
            }


            that.addFetchProperties = function(fetcher) {
                that.datePropId = that.ctrlDateProperty.getValue();
                fetcher.addColumn(that.datePropId, 'F4');
            }

            that.processFetchedPoints = function(pointData, points) {
                if (that.datePropId) {
                    var times = pointData[that.datePropId];
                    for (var nr =0; nr<points.length; nr++) {
                        points[nr].dateJD = times[nr];
                    }
                }
            }

            that.clearPoints = function() {
                that.myTimeLine.clearPoints();
            };

            that.setPoints = function(points, settings) {
                that.myTimeLine.setPoints(points, settings);

            };

            that.draw = function() {
                that.myTimeLine.setDrawStyle({
                    showTimeBarsAsPercentage: that.ctrl_showTimeBarsAsPercentage.getValue()
                });
                that.myTimeLine.draw();
            }

            that.updateSelection = function() {
                that.myTimeLine.updateSelection();
            }

            that.updateTimeViewPort = function() {
                if (that.ctrl_restrictToTimeViewPort.getValue()) {
                    var timeRange = that.myTimeLine.getVisibleTimeRange();
                    that.thePlot.pointSet.setPointFilter('timeFilter', function(pt) {
                        return (pt.dateJD<timeRange.min)||(pt.dateJD>timeRange.max);
                    });
                    that.thePlot.updateMapPoints();
                    that.thePlot.pointSet.draw();
                }
            }


            that.fetchTimeRangeSelection = function(JDmin, JDmax) {
                if (!that.thePlot.points)  return;
                var points = that.thePlot.points;
                var selectionInfo = that.tableInfo.currentSelection;
                var modified = false;
                for (var nr =0; nr<points.length; nr++) {
                    var sel = (points[nr].dateJD>=JDmin) && (points[nr].dateJD<=JDmax);
                    if (sel!=!!(selectionInfo[points[nr].id])) {
                        modified = true;
                        that.tableInfo.selectItem(points[nr].id, sel);
                    }
                }
                if (modified)
                    Msg.broadcast({type:'SelectionUpdated'}, that.tableInfo.id);
            }

            that.storeSettings = function() {
                var obj = {};
                obj.timeLine = that.myTimeLine.storeSettings();
                return obj;
            }

            that.recallSettings = function(settObj) {
                that.myTimeLine.recallSettings(settObj.timeLine);
            }


            return that;

        }











        GeoTemporal.Create = function(tableid, settings, startQuery) {
            var that = GenericPlot.Create(tableid, 'GeoTemporal', {title:'Geotemporal analysis' }, startQuery);

            that.pointData = {};//first index: property id, second index: point nr


            var eventid = DQX.getNextUniqueID();that.eventids.push(eventid);
            Msg.listen(eventid,{ type: 'SelectionUpdated'}, function(scope,tableid) {
                if (that.tableInfo.id==tableid)
                    that.updateSelection();
            } );


            that.plotComponents = {};

            that.plotComponents.timeLine = GeoTemporal.CreateComp_TimeLine(that);

            that.createFrames = function() {
                that.frameRoot.makeGroupHor();
                that.frameButtons = that.frameRoot.addMemberFrame(Framework.FrameFinal('', 0.3))
                    .setAllowScrollBars(false,true).setMinSize(Framework.dimX,240);
                var frameRight = that.frameRoot.addMemberFrame(Framework.FrameGroupVert('', 0.7));
                that.plotComponents.timeLine.frame = frameRight.addMemberFrame(Framework.FrameFinal('', 0.3))
                    .setAllowScrollBars(false,false);
                that.frameGeoMap = frameRight.addMemberFrame(Framework.FrameFinal('', 0.7))
                    .setAllowScrollBars(false,false);
            };





            that.createControlsMap = function() {

                var cmdZoomToFit = Controls.Button(null, { content: 'Zoom to fit', buttonClass: 'PnButtonSmall'}).setOnChanged(function () {
                    that.pointSet.zoomFit();
                });

                var onStopLassoSelection = function() {
                    cmdLassoSelection.changeContent('Lasso select Points');
                    that.theMap.stopLassoSelection();
                    cmdLassoSelection.busy = false;
                    that.fetchLassoSelection();
                };

                var cmdLassoSelection = Controls.Button(null, { content: 'Lasso select Points', buttonClass: 'PnButtonSmall'}).setOnChanged(function () {
                    cmdLassoSelection.busy = !cmdLassoSelection.busy;
                    if (cmdLassoSelection.busy) {
                        cmdLassoSelection.changeContent('Complete lasso selection');
                        that.theMap.startLassoSelection(onStopLassoSelection);
                    }
                    else {
                        onStopLassoSelection();
                    }
                });


                that.ctrl_PointShape = Controls.Combo(null,{ label:'Point shape:', states: [{id: 'rectangle', 'name':'Rectangle'}, {id: 'circle', 'name':'Circle'}, {id: 'fuzzy', 'name':'Fuzzy'}], value:'rectangle' }).setClassID('pointShape')
                    .setOnChanged(function() {
                        that.reDraw();
                    });


                that.ctrl_PointSize = Controls.ValueSlider(null, {label: 'Point size', width: 170, minval:0.1, maxval:10, value:2, digits: 2}).setClassID('pointSize')
                    .setNotifyOnFinished()
                    .setOnChanged(function() {
                        that.reDraw();
                    });

                that.ctrl_Opacity = Controls.ValueSlider(null, {label: 'Point opacity', width: 170, minval:0, maxval:1, value:1, digits: 2}).setClassID('pointOpacity')
                    .setNotifyOnFinished()
                    .setOnChanged(function() {
                        that.reDraw();
                    });

                that.ctrl_AggrType = Controls.Combo(null,{ label:'Style:', states: [{id: 'piechart', 'name':'Pie chart'}, {id: 'cluster', 'name':'Cluster'}], value:'piechart' }).setClassID('aggrStyle')
                    .setOnChanged(function() {
                        that.reDraw();
                    });

                that.ctrl_AggrSize = Controls.ValueSlider(null, {label: 'Size', width: 150, minval:10, maxval:100, value:20, digits: 0}).setClassID('aggrSize')
                    .setNotifyOnFinished()
                    .setOnChanged(function() {
                        that.reDraw();
                    });

                var grp = Controls.CompoundVert([
                    cmdZoomToFit,
                    cmdLassoSelection,
                    Controls.VerticalSeparator(10),
                    that.ctrl_PointShape,
                    that.ctrl_PointSize,
                    that.ctrl_Opacity,
                    Controls.CompoundVert([that.ctrl_AggrType, that.ctrl_AggrSize]).setLegend('Aggregated points')
                    ]);
                grp.setLegend('<h4>Map</h4>');
                return grp;
            }

            that.createPanels = function() {
                that.panelButtons = Framework.Form(that.frameButtons).setPadding(5);

                var ctrl_Query = that.theQuery.createControl();

                var propList = [ {id:'', name:'-- None --'}];
                $.each(MetaData.customProperties, function(idx, prop) {
                    var included = false;
                    if ( (prop.tableid==that.tableInfo.id) && ( (prop.datatype=='Text') || (prop.datatype=='Boolean') || (prop.datatype=='Value') || (prop.datatype=='Date') ) )
                        propList.push({ id:prop.propid, name:prop.name });
                });
                that.ctrlColorProperty = Controls.Combo(null,{ label:'Color:', states: propList }).setClassID('pointcolor');
                that.ctrlColorProperty.setOnChanged(function() {
                    that.fetchData();
                });

                that.colorLegend = Controls.Html(null,'');

                var controlsList = [ctrl_Query,
                    Controls.VerticalSeparator(2),
                    Controls.CompoundVert([that.ctrlColorProperty, that.colorLegend]).setLegend('<h4>Overlay</h4>')];

                $.each(that.plotComponents, function(key, plotComp) {
                    controlsList.push(Controls.VerticalSeparator(2));
                    controlsList.push(plotComp.createControls());
                });

                var groupMapControls = that.createControlsMap();

                controlsList.push(Controls.VerticalSeparator(2));
                controlsList.push(groupMapControls);





                var controlsGroup = Controls.CompoundVert(controlsList);
                that.addPlotSettingsControl('controls',controlsGroup);
                that.panelButtons.addControl(controlsGroup);


                $.each(that.plotComponents, function(key, plotComp) {
                    plotComp.createView();
                });

                that.theMap = Map.GMap(this.frameGeoMap);




                // Create points overlay on map
                that.pointSet = PointSet.Create(that.theMap, {});
                that.pointSet.setPointClickCallBack(
                    function(itemid) { // single point click handler
                        Msg.send({ type: 'ItemPopup' }, { tableid: that.tableInfo.id, itemid: itemid } );
                    },
                    function(pieChartInfo) { // pie chart click handler
                        var qry = that.theQuery.get();
                        var range = 0.0001;
                        qry = SQL.WhereClause.createRangeRestriction(qry, that.tableInfo.propIdGeoCoordLongit, pieChartInfo.longit-range, pieChartInfo.longit+range);
                        qry = SQL.WhereClause.createRangeRestriction(qry, that.tableInfo.propIdGeoCoordLattit, pieChartInfo.lattit-range, pieChartInfo.lattit+range);
                        Msg.send({type: 'DataItemTablePopup'}, {
                            tableid: that.tableInfo.id,
                            query: qry,
                            title: that.tableInfo.tableCapNamePlural + ' at ' + pieChartInfo.longit + ', ' + pieChartInfo.lattit
                        });
                    }
                );

                if (settings && settings.zoomFit)
                    that.startZoomFit = true;
                that.reloadAll();
            };


            that.storeCustomSettings = function() {
                var sett = {};
                sett.mapSettings = that.theMap.storeSettings();

                $.each(that.plotComponents, function(key, plotComp) {
                    sett[key] = plotComp.storeSettings();
                })

                return sett;
            };

            that.recallCustomSettings = function(sett) {
                that.theMap.recallSettings(sett.mapSettings);
                $.each(that.plotComponents, function(key, plotComp) {
                    plotComp.recallSettings(sett[key]);
                })
            };

            that.reloadAll = function() {
                that.fetchData();
            };

            that.fetchData = function() {
                var fetcher = DataFetchers.RecordsetFetcher(MetaData.serverUrl, MetaData.database, that.tableInfo.id + 'CMB_' + MetaData.workspaceid);
                fetcher.setMaxResultCount(999999);

                that.pointSet.clearPoints();

                $.each(that.plotComponents, function(idx, comp) {
                    comp.clearPoints();
                })

                that.points = null;
                that.colorLegend.modifyValue('');

                var sortField = that.tableInfo.primkey;

                $.each(that.plotComponents, function(key, plotComp) {
                    plotComp.addFetchProperties(fetcher);
                });
                //sortField = that.datePropId;

                if (!that.pointData[that.tableInfo.primkey])
                    fetcher.addColumn(that.tableInfo.primkey, 'ST');
                if (!that.pointData[that.tableInfo.propIdGeoCoordLongit])
                    fetcher.addColumn(that.tableInfo.propIdGeoCoordLongit, 'F4');
                if (!that.pointData[that.tableInfo.propIdGeoCoordLattit])
                    fetcher.addColumn(that.tableInfo.propIdGeoCoordLattit, 'F4');
                that.catPropId = null;
                that.numPropId = null;
                if (that.ctrlColorProperty.getValue()) {
                    var propInfo = MetaData.findProperty(that.tableInfo.id, that.ctrlColorProperty.getValue());
                    if ( (propInfo.datatype=='Text') || (propInfo.datatype=='Boolean') ) {
                        that.catPropId = that.ctrlColorProperty.getValue();
                        if (!that.pointData[that.catPropId])
                            fetcher.addColumn(that.catPropId, 'ST');
                    }
                    if (propInfo.isFloat) {
                        that.numPropId = that.ctrlColorProperty.getValue();
                        if (!that.pointData[that.numPropId])
                            fetcher.addColumn(that.numPropId, 'ST');
                    }
                }

                if (fetcher.getColumnIDs().length <= 0) {
                    that.setPoints();
                    return;
                }

                var requestID = DQX.getNextUniqueID();
                that.requestID = requestID;
                var selectionInfo = that.tableInfo.currentSelection;
                fetcher.getData(that.theQuery.get(), sortField,
                    function (data) { //success
                        if (that.requestID == requestID) {
                            $.each(data, function(id, values) {
                                that.pointData[id] = values;
                            });
                            that.setPoints();
                            if (that.startZoomFit) {
                                that.pointSet.zoomFit(100);
                                that.startZoomFit = false;
                            }
                        }
                    },
                    function (data) { //error
                        that.fetchCount -= 1;
                    }

                );
            }

            that.setPoints = function() {
                var keys = that.pointData[that.tableInfo.primkey];
                var longitudes = that.pointData[that.tableInfo.propIdGeoCoordLongit];
                var lattitudes = that.pointData[that.tableInfo.propIdGeoCoordLattit];
                var selectionInfo = that.tableInfo.currentSelection;

                if (that.catPropId) {
                    var catPropInfo = MetaData.findProperty(that.tableInfo.id, that.catPropId);
                    var catProps = that.pointData[that.catPropId];
                    var colormapper = MetaData.findProperty(that.tableInfo.id, that.catPropId).category2Color;

                    for (var i=0; i<catProps.length; i++)
                        catProps[i] = catPropInfo.toDisplayString(catProps[i]);

                    var catMap = {};
                    var cats = []
                    for (var i=0; i<catProps.length; i++) {
                        if (!catMap[catProps[i]]) {
                            catMap[catProps[i]] = true;
                            cats.push(catProps[i]);
                        }
                    }

                    colormapper.map(cats);
                    var catData = [];
                    for (var i=0; i<catProps.length; i++) {
                        var idx = colormapper.get(catProps[i]);
                        if (idx<0)
                            idx = colormapper.itemCount-1;
                        catData.push(idx);
                    }

                    var legendStr = '';
                    $.each(cats,function(idx,value) {
                        if ((colormapper.get(value)>=0)&&(colormapper.get(value)<colormapper.itemCount-1))
                            legendStr+='<span style="background-color:{cl}">&nbsp;&nbsp;&nbsp;&nbsp;</span>&nbsp;{name}<br>'.DQXformat({cl:DQX.standardColors[colormapper.get(value)].toString(), name:value});
                    });
                    that.colorLegend.modifyValue(legendStr);
                }

                if (that.numPropId) {
                    var numPropInfo = MetaData.findProperty(that.tableInfo.id, that.numPropId);
                    var numProps = that.pointData[that.numPropId];
                    that.numPropMin = 1.0e99;
                    that.numPropMax = -1.0e99;
                    $.each(numProps, function(idx, val) {
                        that.numPropMax = Math.max(that.numPropMax, val);
                        that.numPropMin = Math.min(that.numPropMin, val);
                    });
                    that.numPropRange = that.numPropMax - that.numPropMin;
                    if (that.numPropRange <= 0)
                        that.numPropRange = 1;
                }


                that.points = [];
                for (var nr =0; nr<keys.length; nr++) {
                    var itemid = keys[nr];
                    var pt =
                    {
                        id: itemid,
                        longit: longitudes[nr],
                        lattit: lattitudes[nr],
                        sel: !!(selectionInfo[itemid])
                    }
                    if (catProps) {
                        pt.catName = catProps[nr];
                        pt.catNr = catData[nr];
                    }
                    else pt.catNr = 0;
                    if (numProps) {
                        pt.numProp = numProps[nr];
                        pt.numPropFrac = (numProps[nr]-that.numPropMin)/that.numPropRange;
                    }
                    that.points.push(pt);
                }

                $.each(that.plotComponents, function(key, plotComp) {
                    plotComp.processFetchedPoints(that.pointData, that.points);
                });

                that.updateMapPoints();

                $.each(that.plotComponents, function(idx, plotComp) {
                    plotComp.setPoints(that.points, {
                        catData: !!that.catPropId,
                        numData: !!that.numPropId
                    });
                });

                that.reDraw();
            }

            that.updateMapPoints = function() {
                if (that.points) {
                    that.pointSet.setPoints(that.points, {
                        catData: !!that.catPropId,
                        numData: !!that.numPropId
                    });
                }
            }


            that.updateSelection = function() {
                if (!that.points)  return;
                var points = that.points;
                var selectionInfo = that.tableInfo.currentSelection;
                for (var nr =0; nr<points.length; nr++)
                    points[nr].sel = !!(selectionInfo[points[nr].id]);
                that.pointSet.updateSelection();

                $.each(that.plotComponents, function(key, plotComp) {
                    plotComp.updateSelection();
                });
            }

            that.fetchLassoSelection = function() {
                if (!that.points)  return;
                var points = that.points;
                var selectionInfo = that.tableInfo.currentSelection;
                var modified = false;
                for (var nr =0; nr<points.length; nr++) {
                    var sel = that.theMap.isCoordInsideLassoSelection(Map.Coord(points[nr].longit, points[nr].lattit));
                    if (sel!=!!(selectionInfo[points[nr].id])) {
                        modified = true;
                        that.tableInfo.selectItem(points[nr].id, sel);
                    }
                }
                if (modified)
                    Msg.broadcast({type:'SelectionUpdated'}, that.tableInfo.id);
            }



            that.notifyPropertyContentChanged = function(propid) {
                if (that.pointData[propid]) {
                    that.pointData[propid] = null;
                    that.fetchData()
                }
            }

            that.reloadAll = function() {
                that.pointData = {}; // remove all stored data
                that.fetchData();
            }

            that.reDraw = function() {
                that.pointSet.setPointStyle({
                    opacity: Math.pow(that.ctrl_Opacity.getValue(),1.5),
                    pointSize: that.ctrl_PointSize.getValue(),
                    pointShape: that.ctrl_PointShape.getValue(),
                    aggrSize: that.ctrl_AggrSize.getValue(),
                    aggregateStyle: that.ctrl_AggrType.getValue()
                });
                that.pointSet.draw();

                $.each(that.plotComponents, function(key, plotComp) {
                    plotComp.draw();
                })

            }


            that.updateQuery = function() {
                that.reloadAll();
            }


            that.theQuery.notifyQueryUpdated = that.updateQuery;
            that.create();
            return that;
        }



        return GeoTemporal;
    });


