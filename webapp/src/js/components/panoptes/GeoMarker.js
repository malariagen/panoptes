import React from 'react';

// Mixins
import PureRenderMixin from 'mixins/PureRenderMixin';
import FluxMixin from 'mixins/FluxMixin';

import 'geo-marker.scss';

let GeoMarker = React.createClass({

  mixins: [
    PureRenderMixin,
    FluxMixin
  ],

  propTypes: {
    title: React.PropTypes.string,
    radius: React.PropTypes.number,
    onClick: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      radius: 10
    };
  },

  render() {
    let {title, radius, onClick} = this.props;

    let height = 50;
    let width = 50;
    let translateX = 0;
    let translateY = 0;

    return (
      <svg style={{overflow: 'visible'}} width={width} height={height}>
          <g className="geo-marker" onClick={onClick} transform={'translate(' + translateX + ', ' + translateY + ')'}>
            <title>{title}</title>
            <circle cx="0" cy="0" r={radius} />
          </g>
      </svg>
    );

  }

});

module.exports = GeoMarker;
