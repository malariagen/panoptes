import React from 'react';
import DivIcon from 'react-leaflet-div-icon';

// Mixins
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin';
import DataFetcherMixin from 'mixins/DataFetcherMixin';

// Panoptes
import API from 'panoptes/API';
import ErrorReport from 'panoptes/ErrorReporter';
import FeatureGroupWidget from 'Map/FeatureGroup/Widget';
import LRUCache from 'util/LRUCache';
import MarkerWidget from 'Map/Marker/Widget';

/* Example usage in template

<p>A map of sampling sites:</p>
<div style="position:relative;width:300px;height:300px">
<TableMap geoTable="samplingsites" />
</div>
<p>A map of a sampling site:</p>
<div style="position:relative;width:300px;height:300px">
<TableMap geoTable="samplingsites" primKey="St04" />
</div>

*/

let TableMarkersLayerWidget = React.createClass({

  mixins: [
    FluxMixin,
    ConfigMixin,
    DataFetcherMixin('geoTable', 'primKey', 'highlight')
  ],

  propTypes: {
    highlight: React.PropTypes.string,
    layerContainer: React.PropTypes.object,
    map: React.PropTypes.object,
    onChangeLoadStatus: React.PropTypes.func,
    primKey: React.PropTypes.string, // if not specified then all table records are used
    geoTable: React.PropTypes.string
  },

  contextTypes: {
    onChangeLoadStatus: React.PropTypes.func
  },

  childContextTypes: {
    onClickMarker: React.PropTypes.func
  },


  getInitialState() {
    return {
      markers: []
    };
  },

  // Event handlers
  handleClickMarker(e, marker) {
console.log('e %o', e);
console.log('marker %o', marker);

    let {table, primKey} = marker;
    const middleClick =  e.originalEvent.button == 1 || e.originalEvent.metaKey || e.originalEvent.ctrlKey;
    if (!middleClick) {
      e.originalEvent.stopPropagation();
    }
    this.getFlux().actions.panoptes.dataItemPopup({table: table, primKey: primKey.toString(), switchTo: !middleClick});
  },

  fetchData(props, requestContext) {
//FIXME: Initial load from ListWithActions (default 1st selected) > DataItemWidget, isn't showing marker.
    let {highlight, primKey, geoTable} = props;
    let {onChangeLoadStatus} = this.context;
    let locationTableConfig = this.config.tablesById[geoTable];
    // Check that the table specified for locations has geographic coordinates.
    if (locationTableConfig.hasGeoCoord === false) {
      console.error('locationTableConfig.hasGeoCoord === false');
      return null;
    }

    onChangeLoadStatus('loading');

    let locationPrimKeyProperty = locationTableConfig.primKey;

    // TODO: support lngProperty and latProperty props, to specify different geo columns.
    // If specified, use the lat lng properties from the props.
    // Otherwise, use the lat lng properties from the config.
    // let locationLongitudeProperty = lngProperty ? lngProperty : locationTableConfig.longitude;
    // let locationLatitudeProperty = latProperty ? latProperty : locationTableConfig.latitude;

    let locationLongitudeProperty = locationTableConfig.longitude;
    let locationLatitudeProperty = locationTableConfig.latitude;

    let locationColumns = [locationPrimKeyProperty, locationLongitudeProperty, locationLatitudeProperty];

    if (highlight) {
      let [highlightField] = highlight.split(':');
      if (highlightField) {
        locationColumns.push(highlightField);
      }
    }

    let locationColumnsColumnSpec = {};
    locationColumns.map((column) => locationColumnsColumnSpec[column] = locationTableConfig.propertiesById[column].defaultDisplayEncoding);

    requestContext.request(
      (componentCancellation) => {

        // If a primKey value has been specified, then fetch that single record,
        // Otherwise, do a page query.
        if (primKey) {

          // Fetch the single record for the specified primKey value.
          let APIargs = {
            database: this.config.dataset,
            table: geoTable,
            primKeyField: this.config.tablesById[geoTable].primKey,
            primKeyValue: primKey
          };

          return LRUCache.get(
            'fetchSingleRecord' + JSON.stringify(APIargs), (cacheCancellation) =>
              API.fetchSingleRecord({
                cancellation: cacheCancellation,
                ...APIargs
              }),
            componentCancellation
          );

        } else {

          // If no primKey is provided, then get all markers using the specified table.
          let locationAPIargs = {
            database: this.config.dataset,
            table: locationTableConfig.fetchTableName,
            columns: locationColumnsColumnSpec
          };

          return LRUCache.get(
            'pageQuery' + JSON.stringify(locationAPIargs), (cacheCancellation) =>
              API.pageQuery({
                cancellation: cacheCancellation,
                ...locationAPIargs
              }),
            componentCancellation
          );

        }

      })
      .then((data) => {

        let markers = [];

        // Translate the fetched locationData into markers.
        let locationTableConfig = this.config.tablesById[geoTable];
        let locationPrimKeyProperty = locationTableConfig.primKey;

        // If a primKey value has been specified then expect data to contain a single record.
        // Otherwise data should contain an array of records.
        if (primKey) {

          let locationDataPrimKey = data[locationPrimKeyProperty];

          markers.push({
            lat: parseFloat(data[locationTableConfig.latitude]),
            lng: parseFloat(data[locationTableConfig.longitude]),
            title: locationDataPrimKey,
            table: geoTable,
            primKey: locationDataPrimKey
          });

        } else {

          let highlightField, highlightValue = null;
          if (highlight) {
            [highlightField, highlightValue] = highlight.split(':');
          }

          for (let i = 0; i < data.length; i++) {

            let locationDataPrimKey = data[i][locationPrimKeyProperty];

            let isHighlighted = false;
            if (highlightField !== null && highlightValue !== null) {
              isHighlighted = (data[i][highlightField] === highlightValue ? true : false);
            }

            markers.push({
              lat: parseFloat(data[i][locationTableConfig.latitude]),
              lng: parseFloat(data[i][locationTableConfig.longitude]),
              title: locationDataPrimKey,
              table: geoTable,
              primKey: locationDataPrimKey,
              isHighlighted: isHighlighted
            });

          }

        }

        this.setState({
          markers: markers
        });

        onChangeLoadStatus('loaded');
      })
      .catch(API.filterAborted)
      .catch(LRUCache.filterCancelled)
      .catch((error) => {
        ErrorReport(this.getFlux(), error.message, () => this.fetchData(props));

        onChangeLoadStatus('error');
      });
  },

  render() {

    let {layerContainer, map} = this.props;
    let {markers} = this.state;

    if (!markers.length) {
      return null;
    }

    let markerWidgets = [];

    for (let i = 0, len = markers.length; i < len; i++) {

      let marker = markers[i];

      if (marker.isHighlighted || len === 1) {

        markerWidgets.push(
          <MarkerWidget
            key={i}
            position={[marker.lat, marker.lng]}
            layerContainer={layerContainer}
            map={map}
            title={marker.title}
            onClickMarker={(e) => this.handleClickMarker(e, marker)}
          />
        );

      } else {

        markerWidgets.push(
          <DivIcon
            key={i}
            position={[marker.lat, marker.lng]}
            title={marker.title}
            onClick={(e) => this.handleClickMarker(e, marker)}
          >
            <svg height="12" width="12">
              <circle cx="6" cy="6" r="5" stroke="#1E1E1E" strokeWidth="1" fill="#3D8BD5" />
            </svg>
          </DivIcon>
        );

      }

    }

    return (
      <FeatureGroupWidget
        layerContainer={layerContainer}
        map={map}
        children={markerWidgets}
      />
    );

  }

});

module.exports = TableMarkersLayerWidget;
