import React from 'react';
import Immutable from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import Highlight from 'react-highlighter';
import classNames from 'classnames';

// Mixins
import PureRenderMixin from 'mixins/PureRenderMixin';
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin';
import DataFetcherMixin from 'mixins/DataFetcherMixin';

// Panoptes components
import API from 'panoptes/API';
import ErrorReport from 'panoptes/ErrorReporter';
import SQL from 'panoptes/SQL';

// Utils
import LRUCache from 'util/LRUCache';

// Material UI components
import List from 'material-ui/lib/lists/list';
import ListItem from 'material-ui/lib/lists/list-item';

// UI components
import Loading from 'ui/Loading';


let ListView = React.createClass({
  mixins: [
    PureRenderMixin,
    FluxMixin,
    ConfigMixin,
    DataFetcherMixin('table', 'query', 'columns', 'order', 'ascending')
  ],

  propTypes: {
    table: React.PropTypes.string.isRequired,
    query: React.PropTypes.string.isRequired,
    order: React.PropTypes.string,
    ascending: React.PropTypes.bool,
    columns: ImmutablePropTypes.listOf(React.PropTypes.string)
  },

  getDefaultProps() {
    return {
      table: null,
      query: SQL.WhereClause.encode(SQL.WhereClause.Trivial()),
      order: null,
      ascending: true
    };
  },

  getInitialState() {
    return {
      rows: [],
      loadStatus: 'loaded',
      search: ''
    };
  },


  //Called by DataFetcherMixin
  fetchData(props, requestContext) {
    let {table, query, columns, order, ascending} = props;
    let tableConfig = this.config.tables[table];
    let columnspec = {};
    columns.map((column) => columnspec[column] = tableConfig.propertiesMap[column].defaultDisplayEncoding);
    if (props.columns.size > 0) {
      this.setState({loadStatus: 'loading'});
      let APIargs = {
        database: this.config.dataset,
        table: tableConfig.fetchTableName,
        columns: columnspec,
        order: order,
        ascending: ascending,
        query: query,
        start: 0
      };
      requestContext.request((componentCancellation) =>
          LRUCache.get(
            'pageQuery' + JSON.stringify(APIargs),
            (cacheCancellation) =>
              API.pageQuery({cancellation: cacheCancellation, ...APIargs}),
            componentCancellation
          )
        )
        .then((data) => {
          this.setState({
            loadStatus: 'loaded',
            rows: data
          });
        })
        .catch(API.filterAborted)
        .catch(LRUCache.filterCancelled)
        .catch((xhr) => {
          ErrorReport(this.getFlux(), API.errorMessage(xhr), () => this.fetchData(this.props));
          this.setState({loadStatus: 'error'});
        });
    } else {
      this.setState({rows: []});
    }
  },

  componentDidUpdate: function(prevProps, prevState) {
    if (this.props.onShowableRowsCountChange && prevState.showableRowsCount !== this.state.showableRowsCount) {
      this.forceFetch();
      this.props.onShowableRowsCountChange(this.state.showableRowsCount);
    }
    if (this.props.onFetchedRowsCountChange && prevState.rows.length !== this.state.rows.length)
      this.props.onFetchedRowsCountChange(this.state.rows.length);
  },

  handleSelect() {
    // TODO: load the appropriate data item view
  },

  render() {
    let {loadStatus, rows} = this.state;
    let {search} = this.state;

    let tableConfig = this.config.tables[this.props.table];
    if (!tableConfig) {
      console.error(`Error: table ${this.props.table} has no associated config.`);
      return null;
    }

    if (rows.length > 0) {

      let listItems = [];

      rows.map((row, rowIndex) => {

        let primaryText = row[tableConfig.primkey];

        let listItem = (
            <ListItem key={rowIndex}
                      primaryText={<div><Highlight search={search}>{primaryText}</Highlight></div>}
                      onClick={() => this.handleSelect()}
            />
        );

        listItems.push(listItem);

      });


      return (
        <div>
          <List>
            {listItems}
          </List>
          <Loading status={loadStatus}/>
        </div>
      );

    } else {
      return (
        <div>
          <Loading status="custom">No rows</Loading>
        </div>
      );
    }
  }

});

module.exports = ListView;
