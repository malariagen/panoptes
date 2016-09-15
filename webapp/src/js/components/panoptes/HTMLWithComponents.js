import React from 'react';
import HtmlToReact from 'html-to-react';
import ComponentRegistry from 'util/ComponentRegistry';
import _forEach from 'lodash/forEach';

function createStyleJsonFromString(styleString) {
  if (!styleString) {
    return {};
  }
  let styles = styleString.split(';');
  let singleStyle, key, value, jsonStyles = {};
  for (let i = 0; i < styles.length; i++) {
    singleStyle = styles[i].split(':');
    key = camelCase(singleStyle[0]);
    value = singleStyle[1];
    if (key.length > 0 && value.length > 0) {
      jsonStyles[key] = value;
    }
  }
  return jsonStyles;
}

let HTMLWithComponents = React.createClass({

  propTypes: {
    className: React.PropTypes.string,
    children: React.PropTypes.string
  },

  componentWillMount() {
    let htmlToReactParser = new HtmlToReact.Parser(React, {
      lowerCaseAttributeNames: false,
      lowerCaseTags: false,
      recognizeSelfClosing: true
    });
    let defaultProcess = new HtmlToReact.ProcessNodeDefinitions(React).processDefaultNode;
    let processingInstructions = [
      {
        shouldProcessNode: (node) => true,
        processNode: (node, children, index) => {
          const type = ComponentRegistry(node.name);
          if (type) {
            let elementProps = {
              key: index,
            };
            _forEach(node.attribs, function(value, key) {
              switch (key || '') {
                case 'style':
                  elementProps.style = createStyleJsonFromString(node.attribs.style);
                  break;
                case 'class':
                  elementProps.className = value;
                  break;
                default:
                  elementProps[key] = value;
                  break;
              }
            });
            return React.createElement(type, {children, ...node.attribs});
          } else {
            return defaultProcess(node, children, index);
          }
        }
      }
    ];
    let isValidNode = () => true;

    this.htmlToReact = (markupString) =>
      htmlToReactParser.parseWithInstructions(
        markupString,
        isValidNode,
        processingInstructions);
  },

  render() {
    return this.htmlToReact(`<div class="${this.props.className}">${this.props.children}</div>`);
  }
});

module.exports = HTMLWithComponents;
