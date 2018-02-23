import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import withAPIData from 'hoc/withAPIData';
import FluxMixin from 'mixins/FluxMixin';
import ConfigMixin from 'mixins/ConfigMixin'; // Need this?
import HandlebarsWithComponents from 'panoptes/HandlebarsWithComponents';
import IconButton from 'material-ui/IconButton';
import EditDocPage from 'panoptes/EditDocPage';

let DocTemplate = createReactClass({
  displayName: 'DocTemplate',

  mixins: [
    FluxMixin,
    ConfigMixin,
  ],

  propTypes: {
    path: PropTypes.string,
    template: PropTypes.string, // This will be provided via withAPIData
  },

  render() {
    const {path, template, ...otherProps} = this.props;
    return (
      [
        this.config.user.isManager ?
          <IconButton
            aria-label="Edit"
            className="fa fa-edit"
            onClick={() => this.getFlux().actions.session.modalOpen(<EditDocPage path={path}/>)}
            style={{position: 'absolute', left: '0', right: '0', margin: 'auto'}}
          />
          : null,
        template === undefined ? null : React.createElement(HandlebarsWithComponents, otherProps, template)
      ]
    );
  }
});

DocTemplate = withAPIData(DocTemplate, function({props}) {
  return {
    requests: {
      template: {
        method: 'staticContent',
        args: {
          url: `/panoptes/Docs/${this.config.dataset}/${props.path}`
        },
      },
    },
  };
});

export default DocTemplate;
