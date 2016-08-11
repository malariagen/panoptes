import React from 'react';
import HtmlToReact from 'html-to-react';

import ItemLink from 'panoptes/ItemLink';
import TreeContainer from 'containers/TreeContainer';
import PlotContainer from 'containers/PlotContainer';
import PopupButton from 'panoptes/PopupButton';
import MapWidget from 'Map/Widget';
import TileLayerWidget from 'Map/TileLayer/Widget';
import BaseLayerWidget from 'Map/BaseLayer/Widget';
import MarkerWidget from 'Map/Marker/Widget';
import CircleWidget from 'Map/Circle/Widget';
import RectangleWidget from 'Map/Rectangle/Widget';
import OverlayWidget from 'Map/Overlay/Widget';
import FeatureGroupWidget from 'Map/FeatureGroup/Widget';
import PopupWidget from 'Map/Popup/Widget';
import LayersControlWidget from 'Map/LayersControl/Widget';
import TableMapWidget from 'Map/Table/Widget';
import PieChartMapWidget from 'Map/Chart/Pie/Widget';


// TODO: Deprecate ItemMap template component in favour of TableMap

/* TODO:
BarChartMap: (node, children) =>
  <TableMapWidget key={node.attribs.key} {...node.attribs} />,
*/

/*eslint-disable react/display-name */
const components = {
  ItemLink: (node, children) =>
    <ItemLink key={node.attribs.key} {...node.attribs} />,
  Tree: (node, children) =>
    <TreeContainer key={node.attribs.key} {...node.attribs} />,
  Plot: (node, children) =>
    <PlotContainer key={node.attribs.key} {...node.attribs} />,
  PopupButton: (node, children) =>
    <PopupButton key={node.attribs.key} {...node.attribs} />,
  Map: (node, children) =>
    <MapWidget key={node.attribs.key} {...node.attribs} children={children} />,
  LayersControl: (node, children) =>
    <LayersControlWidget key={node.attribs.key} {...node.attribs} children={children} />,
  BaseLayer: (node, children) =>
    <BaseLayerWidget key={node.attribs.key} {...node.attribs} children={children} />,
  TileLayer: (node, children) =>
    <TileLayerWidget key={node.attribs.key} {...node.attribs} />,
  FeatureGroup: (node, children) =>
    <FeatureGroupWidget key={node.attribs.key} {...node.attribs} children={children} />,
  Marker: (node, children) =>
    <MarkerWidget key={node.attribs.key} {...node.attribs} children={children} />,
  Popup: (node, children) =>
    <PopupWidget key={node.attribs.key} {...node.attribs} children={children} />,
  Overlay: (node, children) =>
    <OverlayWidget key={node.attribs.key} {...node.attribs} children={children} />,
  Circle: (node, children) =>
    <CircleWidget key={node.attribs.key} {...node.attribs} />,
  Rectangle: (node, children) =>
    <RectangleWidget key={node.attribs.key} {...node.attribs} />,
  TableMap: (node, children) =>
    <TableMapWidget key={node.attribs.key} {...node.attribs} />,
  PieChartMap: (node, children) =>
    <PieChartMapWidget key={node.attribs.key} {...node.attribs} />
};
/*eslint-enable react/display-name */

/*

<div>
<p>A layered map:</p>
<div style="width:300px;height:300px">
<Map center="[0, 0]" zoom="2"><LayersControl position="topright"><BaseLayer checked="true" name="OpenStreetMap.Mapnik"><TileLayer attribution="FIXME" url="http://{s}.tile.osm.org/{z}/{x}/{y}.png" /></BaseLayer><BaseLayer name="OpenStreetMap.BlackAndWhite"><FeatureGroup><TileLayer attribution="FIXME" url="http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png" /><FeatureGroup><Marker position="[0, 0]"><Popup><div><span>A pretty CSS3 popup. <br /> Easily customizable.</span></div></Popup></Marker><Marker position="[50, 0]"><Popup><div><span>A pretty CSS3 popup. <br /> Easily customizable.</span></div></Popup></Marker></FeatureGroup></FeatureGroup></BaseLayer><Overlay name="Markers with popups"><FeatureGroup><Marker position="[0, 0]"><Popup><div><span>A pretty CSS3 popup. <br /> Easily customizable.</span></div></Popup></Marker><Marker position="[50, 0]"><Popup><div><span>A pretty CSS3 popup. <br /> Easily customizable.</span></div></Popup></Marker></FeatureGroup></Overlay><Overlay checked="true" name="Layer group with circles"><FeatureGroup><Circle center="[0, 0]" fillColor="blue" radius="200" /><Circle center="[0, 0]" fillColor="red" radius="100" stroke="false" /><FeatureGroup><Circle center="[51.51, -0.08]" color="green" fillColor="green" radius="100" /></FeatureGroup></FeatureGroup></Overlay><Overlay name="Feature group"><FeatureGroup color="purple"><Popup><span>Popup in FeatureGroup</span></Popup><Circle center="[51.51, -0.06]" radius="200" /><Rectangle bounds="[[51.49, -0.08],[51.5, -0.06]]" /></FeatureGroup></Overlay></LayersControl></Map>
</div>

*/

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
        processNode: (node, children) => (components[node.name] || defaultProcess)(node, children)
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
