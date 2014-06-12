// This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define([
    "MetaData"
],
    function (
        MetaData
        ) {
        return function SamplesHeader() {
            var that = {};

            that.draw = function (ctx, clip, model, view) {

                var width = ctx.canvas.clientWidth;

                var samplesTableInfo = model.table.row_table;

                var dispPropId = view.samples_property;
                var dispPropInfo = MetaData.findProperty(samplesTableInfo.id, dispPropId);

                var row_keys = model.row_ordinal;

                if (samplesTableInfo.primkey == dispPropId) {
                    var labelMapper = function(key) { return key; };
                }
                else {
                    if (!samplesTableInfo.fieldCache.requestAll(dispPropId, function() {
                        model.update_callback();
                    })) {
                        //todo: draw waiting message
                        return;
                    }
                    var labelMapper = function(key) {
                        return dispPropInfo.toDisplayString(samplesTableInfo.fieldCache.getField(key, dispPropId));
                    };
                }

                var row_height = view.row_height;
                var fontSize = Math.min(12, row_height-1);
                ctx.font = "" + (fontSize) + "px sans-serif";
                ctx.fillStyle = 'rgb(0,0,0)';

                if (row_height>3) {
                    ctx.strokeStyle = "rgba(0,0,0,0.1)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (var i=0; i<=row_keys.length; i++) {
                        var ypos = (i) * (row_height);
                        if ((ypos + (row_height * 10) > clip.t) || (ypos - (row_height * 10) < clip.b)) {
                            ctx.moveTo(0, ypos+0.5);
                            ctx.lineTo(width, ypos+0.5);
                        }
                    }
                    ctx.stroke();
                }

                _.forEach(row_keys, function(key, i) {
                    var ypos = (i+1) * (row_height);
                    if ((ypos + (row_height * 10) > clip.t) || (ypos - (row_height * 10) < clip.b)) {
                        var label = labelMapper(key);
                        ctx.fillText(label, 2, ypos - 1 - (row_height-fontSize)/2);
                    }
                });
            };

            that.event = function (type, ev, offset) {
            };

            return that;
        };
    }
);