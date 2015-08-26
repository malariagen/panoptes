// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "handlebars", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL",
        "DQX/DocEl", "DQX/Utils", "MetaData", "DQX/DataFetcher/DataFetchers", "Utils/MiscUtils"
    ],
    function (require, Handlebars, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, MetaData, DataFetchers, MiscUtils
        ) {

        var DefaultView = {};

        DefaultView.create = function(viewSettings, initialItemData) {
            var that = {};
            that.template = viewSettings.Content;
            Handlebars.registerHelper("map", function (items, name_field, lat_field, long_field) {
                var code = "<div style='overflow:hidden;height:400px;width:520px;'>\n" +
"                  <div id='gmap_canvas' style='height:400px;width:520px;'></div>\n" +
"                      <style>\n" +
"                          #gmap_canvas img {\n" +
"                          max-width: none!important;\n" +
"                          background: none!important\n" +
"                      }\n" +
"                      </style>\n" +
"                  </div>\n" +
"                  <script type='text/javascript'>\n" +
"                      var myOptions = {\n" +
"                          zoom: 12,\n" +
"                          center: new google.maps.LatLng(51.75, -1.25),\n" +
"                          mapTypeId: google.maps.MapTypeId.ROADMAP\n" +
"                      };\n" +
"                      map = new google.maps.Map(document.getElementById('gmap_canvas'), myOptions);var bound = new google.maps.LatLngBounds();\n"
                for (var i=0;i<items.length;i++) {
                    var item = items[i];
                    code +=  "var marker = new google.maps.Marker({\n"+
                        "position: new google.maps.LatLng("+item[lat_field]+","+item[long_field]+"),\n" +
                        "title:'" + item[name_field] +"'\n" +
                    "});\n" +
                    "marker.setMap(map);bound.extend(marker.getPosition());\n" +
                    "var infowindow = new google.maps.InfoWindow({\n" +
                    "content: '"+item[name_field]+"<br>'\n"+
                    "});\n" +
                    "infowindow.open(map, marker);\n"
                }

                code +="map.fitBounds(bound);</script>";

                return new Handlebars.SafeString(code);
            });
            that.compiled_template = Handlebars.compile(that.template);
            that.tableInfo = MetaData.getTableInfo(initialItemData.tableid);
            var childTables = DQX.attrMap(that.tableInfo.relationsParentOf, 'childtableid');
            var usedChildTables = Handlebars.fields_used(that.template, _.keys(childTables));
            that.child_fetchers = {};
            _.each(usedChildTables, function(childId) {
                var childInfo = MetaData.getTableInfo(childId);
                var fetcher = DataFetchers.Table(
                    MetaData.serverUrl,
                    MetaData.database,
                    childId + 'CMB_' + MetaData.workspaceid
                );
                fetcher.myDataConsumer = that;
                fetcher.setReportIfError(true);
                fetcher.setMaxRecordCount(childInfo.settings.MaxCountQueryAggregated || 1000000);
                fetcher.positionField = childInfo.primkey;
                //Todo make tempalte introspection go depper so we don't have to fetch all
                _.each(childInfo.properties, function(prop) {
                    fetcher.addFetchColumnActive(prop.propid, MiscUtils.createEncoderId(childId, prop.propid));
                });
                fetcher.relationInfo = childTables[childId];
                that.child_fetchers[childId] = fetcher;
            });

            that.createFrames = function(parent) {
                that.frameFields = Framework.FrameFinal('', 1).setAllowScrollBars(true,true)
                    .setDisplayTitle(viewSettings.Name);
                parent.addMemberFrame(that.frameFields);
                return that.frameFields;
            };

            that.get_child_data_object = function(childId) {
                var fetcher = that.child_fetchers[childId];
                var items = [];
                for (var i = 0; i < fetcher.totalRecordCount; i++) {
                    var item = {};
                    _.each(MetaData.getTableInfo(childId).properties, function(prop) {
                        item[prop.propid] = fetcher.getColumnPoint(i, prop.propid);
                    });
                    items.push(item)
                }
                return items;
            };

            //This function is called by the datafetcher to inform the view that new data is ready. In reaction, we render the view
            that.notifyDataReady = function () {
                var all_ready = true;
                _.each(that.child_fetchers, function(fetcher, childId) {
                    if (!fetcher.IsDataReady(-1,1000000))
                        all_ready = false;
                });
                if (all_ready) {
                    var template_data = that.itemData.fields;
                    _.each(that.child_fetchers, function(fetcher, childId) {
                        template_data[childId] = that.get_child_data_object(childId);
                    });
                    var content = '';
                    that.id = DQX.getNextUniqueID();
                    var content = '<div id="' + id + '" style="padding:8px">';
                    content += that.compiled_template(template_data);
                    content += '</div>';
                    that.frameFields.setContentHtml(content);
                }
            };

            that.setContent = function (itemData) {
                that.itemData = itemData;
                var callback_will_fire = false;
                _.each(that.child_fetchers, function(fetcher, childId) {
                    var query = SQL.WhereClause.CompareFixed(fetcher.relationInfo.childpropid, '=', itemData.fields[that.tableInfo.primkey]);
                    fetcher.setUserQuery1(query);
                    //We jst set the query so we know it is not ready
                    fetcher.IsDataReady(-1,1000000);
                    callback_will_fire = true;
                });
                //If we have no child fetchers then we need to manually notify
                if (!callback_will_fire)
                    that.notifyDataReady();
            };

            that.createPanels = function() {
                that.setContent(initialItemData)
            };


            that.update = function(newItemData) {
                $('#'+that.id).remove();
                that.setContent(newItemData);
            };


            that.onClose = function() {
            }

            return that;
        }

        return DefaultView;
    });



