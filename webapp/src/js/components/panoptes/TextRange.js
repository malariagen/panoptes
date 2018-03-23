import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import PureRenderMixin from 'mixins/PureRenderMixin';

import SQL from 'panoptes/SQL';
import withAPIData from 'hoc/withAPIData';
import {format} from 'd3-format';
import _isUndefined from 'lodash.isundefined';

let TextRange = createReactClass({
  displayName: 'TextRange',

  mixins: [
    PureRenderMixin,
  ],

  propTypes: {
    query: PropTypes.string,
    property: PropTypes.string,
    table: PropTypes.string.isRequired,
  },

  getDefaultProps() {
    return {
      query: SQL.nullQuery,
    };
  },

  render() {
    let {data} = this.props;
    if (!data) {
      return <span> ... </span>;
    } else {
      const {max, min} = data;
      if (max === min) {
        return <span>in {max}</span>
      } else {
        return <span>between {min} and {max}</span>
      }
    }
  },
});

TextRange = withAPIData(TextRange, ({config, props}) => (
  {
    requests: {
      data: {
        method: 'query',
        args: {
          database: config.dataset,
          table: props.table,
          columns: [
            {expr: ['min', [props.property]], as: 'min'},
            {expr: ['max', [props.property]], as: 'max'},
          ],
          query: props.query,
        }
      }
    }
  })
);

export default TextRange;
