// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["_", "Utils/TwoDCache", "MetaData", "DQX/ArrayBufferClient", "DQX/SQL"],
    function (_, TwoDCache, MetaData, ArrayBufferClient, SQL) {
        return function Model(table_info,
                              chromosomes,
                              update_callback,
                              initial_params) {
            var that = {};
            that.init = function(table_info,
                                 chromosomes,
                                 update_callback,
                                 initial_params) {
                that.table = table_info;

                that.chromosomes = chromosomes;
                that.update_callback = update_callback;

                that.first_col_ordinal = 0;
                that.last_col_ordinal = 0;

                that.col_query = SQL.WhereClause.Trivial();
                that.row_query = SQL.WhereClause.Trivial();
                that.col_order = '1';
                that.row_order = '1';
                //Vars set by params - can override those above
                _.extend(that, initial_params);
                that.data = {};
                that.settings = table_info.settings.ShowInGenomeBrowser;
                that.data_type = that.settings.Type;
                if (that.data_type != 'diploid' && that.data_type != 'fractional')
                    DQX.reportError("Genotype data type is not diploid or fractional");
                if (that.data_type == 'diploid') {
                    that.properties = [that.settings.FirstAllele, that.settings.SecondAllele];
                    _.each(that.settings.ExtraProperties, function(prop) {
                        that.properties.push(prop);
                    });
                }
                if (that.data_type == 'fractional') {
                    that.properties = [that.settings.Ref, that.settings.NonRef];
                    _.each(that.settings.ExtraProperties, function(prop) {
                        that.properties.push(prop);
                    });

                }
                that.reset_cache();

            };

            that.update_params = function(new_params){
              var invalidating_change = false;
              _.each(['col_query', 'row_query', 'col_order', 'row_order', 'page_length'], function (param){
                if (that[param] !== new_params[param])
                  invalidating_change = true;
              });
              _.extend(that, new_params);
              if (invalidating_change)
                that.reset_cache();
            };

            that.reset_cache = function() {
                //Create a cache for each chrom
                that.cache_for_chrom = {};
                _.each(that.chromosomes, function (chrom) {
                    that.cache_for_chrom[chrom] = TwoDCache(
                        that.col_order,
                        function(start, end, r_start, r_end, callback) {
                            that.data_provider(chrom, start, end, r_start, r_end, callback);
                        },
                        function () {
                            //Grab the new data from the cache
                            that.refresh_data();
                        },
                        that.page_length
                    )
                });
                that.col_ordinal = [];
                that.row_ordinal = [];
                _.each(that.properties, function(prop) {
                  that.data[prop] = [];
                });
                that.col_positions = [];
                that.col_width = 0;
                that.row_index = [];
                that.genomic_start = 0;
                that.genomic_end = 0;
                that.intervals_being_fetched = [];
            };

            that.position_columns = function (ordinal) {
              var result = new Float64Array(ordinal);

              if (that.width_mode == 'manual')
                that.col_width = that.user_column_width;
              if (that.width_mode == 'auto') {
                if (that.col_ordinal.length > 0)
                  that.col_width = Math.max(3, (0.70 * ((that.col_end - that.col_start) / that.col_ordinal.length)));
                else
                  that.col_width = 0;
              }
              var width = that.col_width;

              if (that.width_mode == 'auto' || that.width_mode == 'manual') {
                var mid_index = Math.floor(result.length / 2);
                for (var cf = 0.1; cf <= 1; cf += 0.1) {
                  //Sweep middle out
                  var psxlast = result[mid_index];
                  for (var i = mid_index + 1, ref = result.length; i < ref; i++) {
                    if (result[i] < psxlast + cf * width)
                      result[i] = psxlast + cf * width;
                    psxlast = result[i];
                  }
                  psxlast = result[mid_index];
                  for (i = mid_index - 1; i >= 0; i--) {
                    if (result[i] > psxlast - cf * width)
                      result[i] = psxlast - cf * width;
                    psxlast = result[i];
                  }
                  cf += 0.1;
                  //Sweep edges in
                  psxlast = -Infinity;
                  for (i = 0, ref = mid_index; i < ref; i++) {
                    if (result[i] < psxlast + cf * width)
                      result[i] = psxlast + cf * width;
                    psxlast = result[i];
                  }
                  psxlast = Infinity;
                  for (i = result.length - 1; i >= mid_index; i--) {
                    if (result[i] > psxlast - cf * width)
                      result[i] = psxlast - cf * width;
                    psxlast = result[i];
                  }
                }

                psxlast = -Infinity;
                for (i = 0, ref = result.length; i < result.length; i++) {
                  if (result[i] < psxlast + width)
                    result[i] = psxlast + width;
                  psxlast = result[i];
                }
                return result;
              }

              if (that.width_mode == 'fill') {
                that.col_width = (that.col_end - that.col_start) / that.col_ordinal.length;
                for (i = 0, ref = result.length; i < result.length; i++) {
                  result[i] = that.col_start + (i*that.col_width) + that.col_width/2;
                }
                return result;
              }
              DQX.reportError("Invalid width_mode")
            };

            that.interpolator = function(pts1, pts2, posValue) {
                if (pts1.length == 0)//No mapping is required in case of 0 points
                    return posValue;
                if (pts1.length == 1)//Shift in case of 1 points
                    return posValue + (pts2[0]-pts1[0]);
                var bkt_min = 0;
                var bkt_max = pts1.length-1;
                if (posValue<pts1[bkt_min])//Left of first data point - linear extension
                    return pts2[bkt_min]+(posValue-pts1[bkt_min]);
                if (posValue>pts1[bkt_max])//Right of last data point - linear extension
                    return pts2[bkt_max]+(posValue-pts1[bkt_max]);
                while (bkt_max>bkt_min+1) {//Inbetween: bracket find interval
                    var bkt_center = Math.round((bkt_min+bkt_max)/2);
                    if (pts1[bkt_center]<posValue)
                        bkt_min = bkt_center;
                    else
                        bkt_max = bkt_center;
                }
                var fr = 0.5;
                if (pts1[bkt_max]>pts1[bkt_min])//linear interpolation of final interval
                    fr = (posValue-pts1[bkt_min])/(pts1[bkt_max]-pts1[bkt_min]);
                return (1-fr)*pts2[bkt_min] + fr*pts2[bkt_max];
            }

            that.mapOrdinal2Pos = function(ordinal) {//Maps ordinal to position by interpolation of the data points
                return that.interpolator(that.col_ordinal, that.col_positions, ordinal);
            }

            that.mapPos2Ordinal = function(pos) {//Maps position to ordinal by interpolation of the data points
                return that.interpolator(that.col_positions, that.col_ordinal, pos);
            }
            

            that.refresh_data = function() {
                var overdraw = (that.col_end - that.col_start)*0.00;
                var data = that.cache_for_chrom[that.chrom].get_by_ordinal(that.col_start-overdraw,  that.col_end+overdraw, that.page-1);
                that.col_ordinal = data.col[that.col_order] || [];
                that.row_ordinal = data.row[that.row_order] || [];
                that.row_primary_key = data.row[that.table.row_table.primkey] || [];
                that.col_primary_key = data.col[that.table.col_table.primkey] || [];
                _.each(that.properties, function(prop) {
                    that.data[prop] = data.twoD[prop] || [];
                });
                that.col_positions = that.position_columns(that.col_ordinal);
                that.intervals_being_fetched = data.intervals_being_fetched;

                //TODO Set row index by sort
                if (that.row_ordinal.length > 0)
                    that.row_index = _.times(that.row_ordinal.length, function (i) {return i;});
                else
                    that.row_index = [];
                that.update_callback();
            }

            that.change_col_range = function(chrom, start, end) {
                that.chrom = chrom;
                that.col_start = start;
                that.col_end = end;
                that.refresh_data();
            };

            that.data_provider = function(chrom, col_ordinal_start, col_ordinal_end, row_index_start, row_index_end, callback) {
                //Modify the horizontal query to just the requested window
                var col_query = that.col_query;
                if (col_query.isTrivial)
                    col_query = [];
                else
                    col_query = [col_query];
                col_query.push(SQL.WhereClause.CompareFixed(that.table.col_table.ChromosomeField, '=', chrom));
                col_query.push(SQL.WhereClause.CompareFixed(that.col_order, '>=', col_ordinal_start));
                col_query.push(SQL.WhereClause.CompareFixed(that.col_order, '<', col_ordinal_end));
                col_query = SQL.WhereClause.AND(col_query);
                var myurl = DQX.Url(MetaData.serverUrl);
                myurl.addUrlQueryItem("datatype", "custom");
                myurl.addUrlQueryItem("respmodule", "panoptesserver");
                myurl.addUrlQueryItem("respid", "2d_query");
                myurl.addUrlQueryItem('dataset', MetaData.database);
                myurl.addUrlQueryItem('datatable', that.table.id);
                myurl.addUrlQueryItem('workspace', MetaData.workspaceid);
                myurl.addUrlQueryItem("col_qry", SQL.WhereClause.encode(col_query));
                myurl.addUrlQueryItem("row_qry", SQL.WhereClause.encode(that.row_query));
                myurl.addUrlQueryItem("col_order", that.col_order);
                myurl.addUrlQueryItem("row_order", that.row_order);
                myurl.addUrlQueryItem("row_offset", row_index_start);
                myurl.addUrlQueryItem("row_limit", row_index_end-row_index_start);
                myurl.addUrlQueryItem("first_dimension", that.table.first_dimension);
                if (that.table.col_table.primkey == that.col_order)
                  myurl.addUrlQueryItem("col_properties", that.col_order);
                else
                  myurl.addUrlQueryItem("col_properties", that.col_order+'~'+that.table.col_table.primkey);
                if (that.table.row_table.primkey == that.row_order)
                  myurl.addUrlQueryItem("row_properties", that.row_order);
                else
                  myurl.addUrlQueryItem("row_properties", that.row_order+'~'+that.table.row_table.primkey);
                myurl.addUrlQueryItem("2D_properties", that.properties.join('~'));
                ArrayBufferClient.request(myurl.toString(),
                    function(data) {
                        callback(col_ordinal_start, col_ordinal_end, row_index_start, row_index_end, data);
                    },
                    function(error) {
                        callback(col_ordinal_start, col_ordinal_end, row_index_start, row_index_end, null);
                    }
                );
            };

            that.init(table_info,
                      chromosomes,
                      update_callback,
                      initial_params);
            return that
        };
    }
);
