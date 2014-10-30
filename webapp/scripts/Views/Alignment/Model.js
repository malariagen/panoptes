// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["_", "async", "Utils/Cache", "MetaData", "DQX/ArrayBufferClient", "DQX/SQL"],
  function (_, async, Cache, MetaData, ArrayBufferClient, SQL) {
    return function Model(update_callback, initial_params) {
      var that = {};
      that.init = function (update_callback, initial_params) {
        that.update_callback = update_callback;

        //Params we expect to get sent in initial_params
        that.bamserve_url = '';
        that.bam_set = '';
        that.sample_id = '';
        //Vars set by params - can override those above
        _.extend(that, initial_params);

        that.data = {};
        that.reset_cache();

      };

      that.update_params = function (new_params) {
        var invalidating_change = false;
        _.each(['bamserve_url', 'bam_set', 'sample_id'], function (param) {
          if (that[param] !== new_params[param])
            invalidating_change = true;
        });
        _.extend(that, new_params);
        if (invalidating_change)
          that.reset_cache();
      };

      that.reset_cache = function () {
        //Create a cache for each chrom
        that.cache = Cache(that.data_provider, that.refresh_data, 1000);
        that.intervals_being_fetched = [];
      };

      that.refresh_data = function () {
        var chunk = 10000;
        var start = Math.floor(that.start / chunk) * chunk;
        //Here we assume for now that reads are not as long as the chunk. We request one chunk lower to get the reads that will partially overlap our area.
        start = start - chunk;
        start = Math.max(start, 0);
        var end = Math.ceil(that.end / chunk) * chunk;
        that.chunks = [];
        for (var i = start; i < end; i += chunk) {
          var key = {
            chrom: that.chrom,
            start: i,
            end: i+chunk
          };
          var data = that.cache.get(key, true);
          if (data)
            that.chunks.push(data);
        }
        that.update_callback();
      };

      that.change_col_range = function (chrom, start, end) {
        that.chrom = chrom;
        that.start = start;
        that.end = end;
        that.refresh_data();
      };

      that.read_provider = function(key, callback) {
        var myurl = that.bamserve_url + '/bam/' +
          that.bam_set + '/' +
          that.sample_id + '/' +
          key.chrom + '/' +
          key.start + '/' +
          key.end;
        ArrayBufferClient.request(myurl,
          function (data) {
            callback(null, data);
          },
          function (error) {
            callback(error);
          }
        );
      };

      that.seq_provider = function(key, callback) {
        //prepare the url
        var myurl = DQX.Url(MetaData.serverUrl);
        myurl.addUrlQueryItem("datatype", 'summinfo');
        myurl.addUrlQueryItem("dataid", key.chrom);
        myurl.addUrlQueryItem("ids", 'SummaryTracks/' + MetaData.database+'/Sequence~Summ~Base_avg');
        myurl.addUrlQueryItem("blocksize", 1);
        myurl.addUrlQueryItem("blockstart", key.start);
        myurl.addUrlQueryItem("blockcount", key.end - key.start);
        var urlstring = myurl.toString();
        $.ajax({
          url: urlstring,
          success: function (data) {
            callback(null, {ref_seq: data.results['SummaryTracks/'+MetaData.database+'/Sequence_Summ_Base_avg'].data});
          },
          error: function (error) { callback(error) }
        });
      };


      that.data_provider = function (skey, callback) {
        var key = JSON.parse(skey);
        async.parallel({
            reads: function (callback) {
              that.read_provider(key, callback);
            },
            ref_seq: function (callback) {
              that.seq_provider(key, callback);
            }
          },
          function (err, results) {
            if (err)
              callback(null);
            var data = _.extend({}, key);
            _.extend(data, results.reads);
            _.extend(data, results.ref_seq);
            callback(skey, data);
          }
        );
      };

      that.init(update_callback,
        initial_params);
      return that
    };
  }
);


