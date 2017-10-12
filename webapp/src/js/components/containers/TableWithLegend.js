import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin';
import SQL from 'panoptes/SQL';
import MuiDataTableView from 'panoptes/MuiDataTableView';
import Card, {CardContent} from 'material-ui/Card';
import {withStyles} from 'material-ui/styles';

const styles = (theme) => ({
  card: {
    maxWidth: 650,
  },
});

let TableWithLegend = createReactClass({
  displayName: 'TableWithLegend',
  mixins: [FluxMixin, ConfigMixin],

  propTypes: {
    table: PropTypes.string,
    query: PropTypes.string,
    order: PropTypes.array,
    columns: PropTypes.oneOfType(PropTypes.array, PropTypes.string),
    columnWidths: PropTypes.object,
    children: PropTypes.node,
    classes: PropTypes.object
  },

  getInitialState() {
    return {};
  },

  getDefinedQuery(query, table) {
    return (query || this.props.query) ||
      ((table || this.props.table) ? this.config.tablesById[table || this.props.table].defaultQuery : null) ||
      SQL.nullQuery;
  },

  handleOrderChange(order) {
    this.setState({order});
  },

  render() {
    let {table, query, order, columns, children, classes} = this.props;
    order = this.state.order || order;
    query = this.getDefinedQuery(query, table);

    // NOTE: Samples_and_Variants example is arriving as string
    // <TableWithLegend table="samples" columns='["key", "Site_ID"]'>
    if (typeof columns === 'string') {
      columns = JSON.parse(columns);
    }

    return (
      <div className="vertical stack">
        <div className="centering-container">
          <Card className={classes.card}>
            {children}
            <CardContent>
              <MuiDataTableView
                table={table}
                query={query}
                order={order}
                columns={columns}
                onOrderChange={this.handleOrderChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  },
});

let module = withStyles(styles)(TableWithLegend);
module.displayName = 'TableWithLegend';
export default module;
