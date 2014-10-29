(function (window) {
    var emap = {

        /**
         * Emap's version
         */
        VERSION: "0.0.1",
        /**
         * Authors of Emap
         */
        AUTHOR: {
            name: "Jiang Feng",
            resume: "http://my.oschina.net/FengJ"
        },

        setting: {
            lat: 0,
            lon: 0,
            zoom: 3,
            LIMIT_MAX_ZOOM: 8,
            LIMIT_MIN_ZOOM: 0,
            baseDir: "",
            layers: {},
            handles: {},
            listeners: {},
            graphs: {},
            toolbar: null,
            makePos: function (lat, lon) {
                alert("makePos 方法必须被重写");
                return null;
            },
            posToLatLon: function (posX, posY) {
                alert("posToLatLon 方法必须被重写");
                return null;
            },
            getEmptyImgSrc: function () {
                return emap.setting.baseDir + "imgs/empty.png";
            }
        },
        events: {
            MOVING: "emap.mapmoving",
            MOVE_END: "emap.mapmoveend",
            ZOOM_END: "emap.mapzoomend",
            MAP_CLICK: "emap.mapclick"
        },

        init: function (options) {
            emap.setting.controllers = [emap.DetailZoomControl, emap.MapMeasureControl];
            emap.setting = $.extend(emap.setting, options);
            this.isIE = (!!window.ActiveXObject || "ActiveXObject" in window);
            this.browser = emap.utils.uaMatch();
            this.isFirefox = navigator.userAgent.indexOf('Firefox') >= 0;
            this.isOpera = navigator.userAgent.indexOf('Opera') >= 0;
            this.supportSVG = document.createElementNS != null;
        },


        isValidZoom: function (zoom) {
            return zoom <= this.setting.LIMIT_MAX_ZOOM && zoom >= this.setting.LIMIT_MIN_ZOOM;
        }
    };

    emap.Map = function (options) {
        var container = options.container;
        if (typeof container == 'string') {
            container = $("#" + container)[0];
        }
        $(container).css("overflow", "hidden");

        emap.setting = $.extend(emap.setting, options);
        emap.utils.extend(this, emap.setting);
        this.container = container;


        if (this.toolbar != null) {
            var toolbarDom = $('<div></div>')[0];
            $(toolbarDom).html($(this.toolbar).html());
            $(container).append(toolbarDom);
            $(this.toolbar).remove();
        }

        var mapContainer = $('<div></div>')[0];
        $(mapContainer).addClass("emap-container");
        $(mapContainer).css({
            height: "100%",
            position: "relative",
            overflow: "hidden",
            "background-color": "white"
        });
        $(container).append(mapContainer);
        this.size = {width: $(container).width(), height: $(container).height()};
        this.mapContainer = mapContainer;
        this.centerPos = this.makePos(this.lat, this.lon);
        this.layerContainer = new emap.LayerContainer(this);

        this.mode = 0; // 0:normal   1:measure

        this.addLayer(emap.TileLayer);
        this.addLayer(emap.MarkerLayer);
        this.addLayer(emap.ControlLayer, true);
        this.addLayer(emap.VectorLayer, true);
        this.addEventHandler("dragEventHandler", emap.DragEventHandler);
        this.addEventHandler("wheelEventHandler", emap.WheelEventHandler);
        this.addEventHandler("clickEventHandler", emap.ClickEventHandler);
    };

    emap.Map.fn = emap.Map.prototype = {
        draw: function () {
            for (var i in this.layers) {
                this.layers[i].show();
            }
            for (var k in this.handles) {
                this.handles[k].bind();
            }
        },
        resize: function (options) {
            var self = this;
            if (typeof options == 'undefined') {
                options = {
                    width: $(self.mapContainer).width(),
                    height: $(self.mapContainer).height()
                };
            }
            var call = true;
            if (typeof self.onResize == 'function') {
                call = self.onResize.apply(this, [options]);
            }

            if (call) {
                var mapSize = self.getSize();
                var edgeLen = self.getEdgeLen();
            }
        },
        getSize: function () {
            return this.size;
        },
        getEdgeLen: function () {
            return this.getEdgeNum() * this.tilePixel;
        },
        getZoom: function () {
            return this.zoom;
        },
        setMode: function (mode) {
            this.mode = mode;
        },
        getMode: function () {
            return this.mode;
        },
        getMapOffSet: function () {
            return  $(this.mapContainer).offset();
        },
        addLayer: function (layer, noDrag) {
            var self = this;
            var _layer = new layer(self);
            self.layers[_layer.TAG] = _layer;
            if (noDrag) {
                $(self.mapContainer).append(_layer.wrapper);
            } else {
                self.layerContainer.addLayer(_layer);
            }
        },
        getLayer: function (tag) {
            return this.layers[tag];
        },
        addEventHandler: function (id, eventHandler) {
            this.handles[id] = new eventHandler(this);
        },
        addEventListener: function (event, eventListener) {
            this.getEventListeners(event).push(eventListener);
        },
        getEventListeners: function (event) {
            event = event.toLowerCase();
            if (!this.listeners) {
                this.listeners = {};
            }
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            return this.listeners[event];
        },
        removeListener: function (event, listener) {
            var listeners = this.getEventListeners(event);
            emap.utils.removeItem(listeners, listener);
        },
        fireEvent: function (type, params) {
            var listeners = this.getEventListeners(type);
            var param = null;
            if (Object.prototype.toString.call(params) === '[object Array]') {
                params.push(this);
                param = params;
            } else {
                param = [this];
            }
            for (var k in listeners) {
                listeners[k].apply(this, param);
            }
        },
        getMapCenterPos: function () {
            return this.centerPos;
        },
        getLayerContainer: function () {
            return this.layerContainer;
        },
        moveToCenterPos: function (pixelX, pixelY) {
            var layerContainer = this.getLayerContainer();
            layerContainer.setLayerOffsetPos(layerContainer.layerOffset[0] + pixelX, layerContainer.layerOffset[1] + pixelY);
            var edgeLen = this.getEdgeLen(),
                size = this.getSize();
            var newPosX = layerContainer.basePos[0] + (-layerContainer.layerOffset[0] + size.width / 2) / edgeLen;
            var newPosY = layerContainer.basePos[1] + (-layerContainer.layerOffset[1] + size.height / 2) / edgeLen;
            var newCenterPos = new emap.Position(newPosX, newPosY);
            this.centerPos = newCenterPos;
            this.fireEvent(emap.events.MOVE_END, [
                {x: pixelX, y: pixelY}
            ]);
        },
        movingCenterPos: function (pixelX, pixelY) {
            var edgeLen = this.getEdgeLen(),
                size = this.getSize();
            var layerContainer = this.getLayerContainer();
            layerContainer.setLayerOffsetPos(layerContainer.layerOffset[0] + pixelX, layerContainer.layerOffset[1] + pixelY);
            var newPosX = layerContainer.basePos[0] + (-layerContainer.layerOffset[0] + size.width / 2) / edgeLen;
            var newPosY = layerContainer.basePos[1] + (-layerContainer.layerOffset[1] + size.height / 2) / edgeLen;
            var newCenterPos = new emap.Position(newPosX, newPosY);
            this.centerPos = newCenterPos;
            this.fireEvent(emap.events.MOVING, [
                {x: pixelX, y: pixelY}
            ]);
        },
        zoomToMapCenter: function (pixelX, pixelY, zoom) {
            if (this.getZoom() === zoom) {//如果层级未改变，只需发移动事件，否则对TileLayer有影响
                this.moveToCenterPos(pixelX, pixelY);
            } else {
                var size = this.getSize();
                var wheelPos = this.getMapPosFromPixelPos(pixelX, pixelY);
                var newEdgeLen = this.getEdgeNum(zoom) * emap.setting.tilePixel;
                var newPosX = wheelPos.posX + (size.width / 2 - pixelX) / newEdgeLen;
                var newPosY = wheelPos.posY + (size.height / 2 - pixelY) / newEdgeLen;
                var newCenterPos = new emap.Position(newPosX, newPosY);
                this.centerPos = newCenterPos;
                this.zoomChange(zoom);
            }
        },

        zoomChange: function (newZoom) {
            if (emap.isValidZoom(newZoom)) {
                this.zoom = newZoom;
                this.getLayerContainer().changeMapZoom();
                this.fireEvent(emap.events.ZOOM_END, [
                    {zoom: newZoom}
                ]);
            }
        },

        getMousePixel: function (event) {
            //鼠标针对 地图div左上角的x，y像素
            var mapDivOffset = $(this.mapContainer).offset();
            return {"x": (event.pageX - mapDivOffset.left), "y": (event.pageY - mapDivOffset.top)};
        },
        getMapPosFromPixelPos: function (offsetPixelX, offsetPixelY) {
            var size = this.getSize();
            var centerPos = this.getMapCenterPos();
            var gx = (offsetPixelX - size.width / 2) / this.getEdgeLen() + centerPos.posX;
            var gy = (offsetPixelY - size.height / 2) / this.getEdgeLen() + centerPos.posY;
            return new emap.Position(gx, gy);
        },
        getPixelPosFromMapPos: function (pos) {
            var size = this.getSize();
            var centerPos = this.getMapCenterPos();
            var pixelX = (pos.posX - centerPos.posX) * this.getEdgeLen() + size.width / 2;
            var pixelY = (pos.posY - centerPos.posY) * this.getEdgeLen() + size.height / 2;
            return {x: pixelX, y: pixelY};
        },
        getMapPosFromMouseEvent: function (event) {
            var mapOffset = this.getMapOffSet();
            return this.getMapPosFromPixelPos(event.pageX - mapOffset.left, event.pageY - mapOffset.top);
        },
        getControl: function (tag) {
            var controlLayer = this.layers[emap.ControlLayer.TAG];
            return controlLayer.getControl(tag);
        },
        addMarker: function (marker) {
            var layer = this.layers[emap.MarkerLayer.TAG];
            layer.addMarker(marker);
        },
        createGraph: function () {
            //this.layers[emap.VectorLayer.TAG].draw(gragh);
            var graph = new emap.Graph(this);
            this.graphs[graph.id] = graph;
            return graph;
        },
        removeMarker: function (marker) {
            var layer = this.layers[emap.MarkerLayer.TAG];
            layer.removeMarker(marker);
        },
        getWrapper: function () {
            return this.mapContainer;
        }
    };

    emap.Map.prototype = emap.Map.fn;

    /**
     * LayerContainer
     * @param map
     * @constructor
     */
    emap.LayerContainer = function (map) {
        var wrapper = $('<div></div>')[0];
        $(wrapper).addClass("emap-layers");
        $(wrapper).css({
            position: "absolute",
            left: 0,
            top: 0
        });
        $(map.mapContainer).append(wrapper);
        this.wrapper = wrapper;
        this.map = map;
        this.layerOffset = [0, 0];
        var mapSize = map.getSize();
        var edgeLen = map.getEdgeLen();
        var centerPos = map.getMapCenterPos();
        this.basePos = [centerPos.posX - mapSize.width / 2 / edgeLen, centerPos.posY - mapSize.height / 2 / edgeLen];
    };

    emap.LayerContainer.prototype = {
        addLayer: function (layer) {
            $(this.wrapper).append(layer.wrapper);
        },
        getLayerOffset: function () {
            return this.layerOffset;
        },
        setLayerOffsetPos: function (x, y) {
            this.layerOffset = [x, y];
            this.wrapper.style.left = x + "px";
            this.wrapper.style.top = y + "px";
        },
        changeMapZoom: function () {
            this.layerOffset = [0, 0];
            this.wrapper.style.left = this.layerOffset[0] + "px";
            this.wrapper.style.top = this.layerOffset[1] + "px";


            var mapCenterPos = this.map.getMapCenterPos();
            var mapSize = this.map.getSize();
            var edgeLen = this.map.getEdgeLen();
            this.basePos = [mapCenterPos.posX - mapSize.width / 2 / edgeLen, mapCenterPos.posY - mapSize.height / 2 / edgeLen];
        },
        getWrapper: function () {
            return this.wrapper;
        }
    };


    /**
     * TileLayer
     * @param map
     * @constructor
     */
    emap.TileLayer = function (map) {
        this.map = map;
        var wrapper = $('<div class="emap-tileLayer"></div>')[0];
        $(wrapper).css({
            position: "absolute",
            "z-index": 0
        });
        this.wrapper = wrapper;
        this.grid = [];
        var self = this;
        this.map.addEventListener(emap.events.MOVE_END, function(event){
            self.draggedLayer(event);
        });

        this.map.addEventListener(emap.events.ZOOM_END, function(event){
            self.changedLayerZoom(event);
        });

    };

    emap.TileLayer.TAG = "Emap_TileLayer";

    emap.TileLayer.prototype = {
        TAG: "Emap_TileLayer",
        getTileUrl: function (x, y, zoom) {
            return this.map.getTileUrl(x, y, zoom);
        },
        getWrapper: function () {
            return this.wrapper;
        },
        show: function () {
            this.reset();
        },
        changedLayerZoom: function () {
            this.reset();
        },
        draggedLayer: function () {
            var mapZoom = this.map.getZoom();
            var mapCenterPos = this.map.getMapCenterPos();
            var edgeNum = this.map.getEdgeNum();
            var edgeLen = this.map.getEdgeLen();
            var size = this.map.getSize();
            if (size.width <= 0 || size.height <= 0) {
                return;
            }
            this.resetColumn(mapCenterPos, mapZoom, edgeNum, edgeLen, size);
            this.resetRow(mapCenterPos, mapZoom, edgeNum, edgeLen, size);
        },
        resetColumn: function (mapCenter, mapZoom, edgeNum, edgeLen, size) {
            var grid = this.grid;
            var tile, newX, i, theRow;
            var viewTileX1 = Math.floor((mapCenter.posX * edgeLen - size.width / 2) / emap.setting.tilePixel);
            var viewTileX2 = Math.floor((mapCenter.posX * edgeLen + size.width / 2) / emap.setting.tilePixel);
            var row = grid[0];
            if (!row) {
                return;
            }
            var tileA = row[0];
            if (tileA) {
                while (viewTileX1 < tileA._tileX) {
                    newX = tileA._tileX - 1;
                    for (i = 0; i < grid.length; i++) {
                        theRow = grid[i];
                        tile = theRow.pop();
                        tile.destroy();
                        tile = emap.TileStore.getImageTile();

                        if (theRow[0]) {
                            var posX = theRow[0]._left - emap.setting.tilePixel;
                            var posY = theRow[0]._top;
                            tile.addToLayer(this, newX, theRow[0]._tileY, mapZoom, posX, posY, edgeNum);
                            tile.draw();
                            theRow.unshift(tile);
                        }
                    }
                    tileA = row[0];
                }
            }
            var tileZ = row[row.length - 1];
            if (tileZ) {
                while (viewTileX2 > tileZ._tileX) {
                    newX = tileZ._tileX + 1;
                    for (i = 0; i < grid.length; i++) {
                        theRow = grid[i];
                        tile = theRow.shift();
                        tile.destroy();
                        tile = emap.TileStore.getImageTile();
                        if (theRow[theRow.length - 1]) {
                            posX = theRow[theRow.length - 1]._left + emap.setting.tilePixel;
                            posY = theRow[theRow.length - 1]._top;
                            tile.addToLayer(this, theRow[theRow.length - 1]._tileX + 1, theRow[theRow.length - 1]._tileY, mapZoom, posX, posY, edgeNum);

                            tile.draw();
                            theRow.push(tile);
                        }
                    }
                    tileZ = row[row.length - 1];
                }
            }
        },

        resetRow: function (mapCenter, mapZoom, edgeNum, edgeLen, size) {
            var row, tile, i, posX, posY;
            var grid = this.grid;
            var viewTileY1 = Math.floor((mapCenter.posY * edgeLen - size.height / 2) / emap.setting.tilePixel);
            var viewTileY2 = Math.floor((mapCenter.posY * edgeLen + size.height / 2) / emap.setting.tilePixel);

            var rowA = grid[0];
            if (rowA && rowA[0]) {
                while (viewTileY1 < rowA[0]._tileY) {
                    row = grid.pop();
                    grid.unshift(row);
                    var colsNum = row.length;

                    for (i = 0; i < colsNum; i++) {
                        row[i].destroy();

                        tile = emap.TileStore.getImageTile();

                        posX = rowA[i]._left;
                        posY = rowA[i]._top - emap.setting.tilePixel;
                        tile.addToLayer(this, rowA[i]._tileX, rowA[i]._tileY - 1, mapZoom, posX, posY, edgeNum);

                        tile.draw();
                        row[i] = tile;
                    }
                    rowA = grid[0];
                }
            }
            var rowZ = grid[grid.length - 1];
            if (rowZ && rowZ[0]) {
                while (viewTileY2 > rowZ[0]._tileY) {
                    row = grid.shift();
                    grid.push(row);

                    for (i = 0; i < row.length; i++) {
                        row[i].destroy();

                        tile = emap.TileStore.getImageTile();

                        posX = rowZ[i]._left;
                        posY = rowZ[i]._top + emap.setting.tilePixel;
                        tile.addToLayer(this, rowZ[i]._tileX, rowZ[i]._tileY + 1, mapZoom, posX, posY, edgeNum);

                        tile.draw();
                        row[i] = tile;
                    }
                    rowZ = grid[grid.length - 1];
                }
            }
        },
        reset: function () {
            var row, tile;
            while (this.grid.length > 0) {
                row = this.grid.pop();
                while (row.length > 0) {
                    tile = row.pop();
                    if (tile) {
                        tile.destroy();
                    }
                }
            }

            var mapZoom = this.map.getZoom();
            var mapCenterPos = this.map.getMapCenterPos();
            var edgeNum = this.map.getEdgeNum();
            var edgeLen = this.map.getEdgeLen();
            var size = this.map.getSize();

            var layerOffset = this.map.layerContainer.getLayerOffset();
            var centerTileEdgeX = edgeNum * mapCenterPos.posX + layerOffset[0] / this.map.tilePixel;
            var centerTileEdgeY = edgeNum * mapCenterPos.posY + layerOffset[1] / this.map.tilePixel;

            var centerTileX = Math.floor(centerTileEdgeX);
            var centerTileY = Math.floor(centerTileEdgeY);

            var centerPosX = size.width / 2 + 0.05;//临时性解决image在chrome中半个像素，在0附近取整造成的偏差一个像素问题。chrome使用math.Round()来处理
            var centerPosY = size.height / 2 + 0.05;

            var tileX1 = Math.floor((mapCenterPos.posX * edgeLen - size.width / 2) / this.map.tilePixel);
            var tileY1 = Math.floor((mapCenterPos.posY * edgeLen - size.height / 2) / this.map.tilePixel);
            var tileX2 = Math.ceil((mapCenterPos.posX * edgeLen + size.width / 2) / this.map.tilePixel);
            var tileY2 = Math.ceil((mapCenterPos.posY * edgeLen + size.height / 2) / this.map.tilePixel);

            //为了处理地图的滚动，即使不存在的tile，也必须加入
            var rectLocateX = parseInt((centerTileEdgeX - centerTileX) * this.map.tilePixel);
            var rectLocateY = parseInt((centerTileEdgeY - centerTileY) * this.map.tilePixel);
            var centerTilePosX = centerPosX - rectLocateX;
            var centerTilePosY = centerPosY - rectLocateY;

            //+1 is foor the tils loop
            this._rows = tileY2 - tileY1 + 1;
            this._cols = tileX2 - tileX1 + 1;

            for (var r = 0; r < this._rows; r++) {
                row = [];
                this.grid.push(row);
                for (var c = 0; c < this._cols; c++) {
                    tile = emap.TileStore.getImageTile();
                    row.push(tile);

                    var posX = centerTilePosX + this.map.tilePixel * (c + tileX1 - centerTileX);
                    var posY = centerTilePosY + this.map.tilePixel * (r + tileY1 - centerTileY);
                    tile.addToLayer(this, c + tileX1, r + tileY1, mapZoom, posX, posY, edgeNum);
                    tile.draw();
                }
            }
        }
    };

    emap.MarkerLayer = function (map) {
        this.map = map;
        var wrapper = $('<div class="emap-markerLayer"></div>')[0];
        $(wrapper).css({
            position: "absolute",
            "z-index": 800
        });
        this.wrapper = wrapper;
        var self = this;
        this.map.addEventListener(emap.events.ZOOM_END,function(){
            self.changedLayerZoom();
        });
    };

    emap.MarkerLayer.TAG = "Emap_MarkerLayer";

    emap.MarkerLayer.prototype = {
        TAG: "Emap_MarkerLayer",
        markers: {},
        show: function () {

        },
        addMarker: function (marker) {
            marker.setMap(this.map);
            this.markers[marker.id] = marker;
            $(this.wrapper).append(marker.getWrapper());
        },
        removeMarker: function (marker) {
            $(marker.wrapper).remove();
            delete this.markers[marker.id];
        },
        changedLayerZoom: function () {
            for (var i in this.markers) {
                this.markers[i].show();
            }
        }
    };

    emap.ControlLayer = function (map) {
        this.map = map;
        var wrapper = $('<div class="emap-controlLayer"></div>')[0];
        $(wrapper).css({
            "z-index": 2000
        });
        this.wrapper = wrapper;
        this.controls = {};
    };

    emap.ControlLayer.TAG = "Emap_ControlLayer";

    emap.ControlLayer.prototype = {
        TAG: "Emap_ControlLayer",
        show: function () {
            for (var i in emap.setting.controllers) {
                var control = emap.setting.controllers[i];
                this.addControl(new control(this.map));
            }
        },
        getWrapper: function () {
            return this.wrapper;
        },
        addControl: function (control) {
            this.controls[control.TAG] = control;
            $(this.getWrapper()).append(control.getWrapper());
        },
        getControl: function (tag) {
            return this.controls[tag];
        }
    };

    emap.VectorLayer = function (map) {
        this.map = map;
        var wrapper = $('<div class="emap-vectorLayer"></div>')[0];
        $(wrapper).css({
            "z-index": 200,
            "height": "100%",
            "width": "100%"
        });
        this.wrapper = wrapper;

        var self = this;
        this.map.addEventListener(emap.events.MOVE_END, function(){
            self.draggedLayer();
        });
        this.map.addEventListener(emap.events.MOVING,function(){
            self.draggedLayer();
        });
        this.map.addEventListener(emap.events.ZOOM_END, function(){
            self.changedLayerZoom();
        });
        this.currentGraph = new jxGraphics(this.wrapper);
    };
    emap.VectorLayer.TAG = "Emap_VectorLayer";
    emap.VectorLayer.prototype = {
        TAG: "Emap_VectorLayer",
        show: function () {

        },
        getWrapper: function () {
            return this.wrapper;
        },
        reDrawGraph: function () {
            var shapes = this.currentGraph.getShapes();
            for (var i in shapes) {
                var shape = shapes[i];
                var points = shape.getPoints();
                for (var j in points) {
                    points[j].replace(this.map);
                }
                shape.draw(this.currentGraph);
            }
        },
        draggedLayer: function (p) {
            this.reDrawGraph();
        },
        changedLayerZoom: function () {
            this.reDrawGraph();
        }
    };

    emap.Graph = function (map) {
        this.map = map;
        var layer = this.map.getLayer(emap.VectorLayer.TAG);
        this.currentGraph = layer.currentGraph;
        this.id = "Emap_Graph" + emap.Graph.INDEX++;
        this.drawingPoints = [];
        this.tempShape = null;
        this.tempShapes = [];
        this.drawingOptions = {};
        this.drawing = false;
        this.supportShapes = ["line", "rect", "polyline", "polygon", "circle", "ellipse", "arc", "arcsector", "curve", "closedcurve", "bezier", "functiongraph", "text", "image"];
        this.drawingDefaultOptions = {
            pen: new jxPen(new jxColor('red'), '2px'),
            brush: null,
            beforeDrawing: function () {
            },
            afterDrawing: function () {
            },
            onDrawingClick: function () {
            }
        };
    };

    emap.Graph.INDEX = 0;

    emap.Graph.prototype = {
        draw: function (shape) {
            shape.draw(this.currentGraph);
            return this;
        },
        tempDraw: function (shape, save) {
            if (!shape) {
                return;
            }
            if (this.tempShape) {
                this.currentGraph.removeShape(this.tempShape);
                this.tempShape.remove();
            }
            if (save) {
                this.tempShapes[this.tempShapes.length] = shape;
            } else {
                this.tempShape = shape;
            }
            shape.draw(this.currentGraph);
        },
        create: function (options) {
            if (this.drawing) {
                this.cleanDrawing();
            }
            this.drawing = true;

            if (!options.shape) {
                return;
            }
            this.drawingOptions = $.extend(this.drawingDefaultOptions, options);
            var shape = options.shape.toLowerCase();
            this.map.setMode(1);
            if (this.supportShapes.indexOf(shape) >= 0) {
                this.startDrawing();
            } else {
                alert("未知的绘图类型");
            }
        },
        drawingClick: function (e) {
            var self = e.data;
            if (self.map.getMode() !== 1) {
                return;
            }
            var point = self.addMapPoint(e);
            if (point != null) {
                self.onDrawingClick(point);
            }
        },
        onDrawingClick: function (point) {
            var self = this;
            this.drawingOptions.onDrawingClick.apply(this, [point, self]);
            var shape = this.drawingOptions.shape.toLowerCase();
            var pen = self.drawingOptions.pen;
            var brush = self.drawingOptions.brush;
            if (shape === 'line' || shape === 'rect' || shape === 'circle' || shape === 'ellipse') {
                if (self.getDrawingPointCount() === 1) {
                    $(self.map.getWrapper()).bind("mousemove", self, self.drawingMove);
                } else if (self.getDrawingPointCount() === 2) {
                    self.endDrawing();
                }
            } else if (shape === 'polyline' || shape === 'polygon' || shape === 'curve' || shape === 'closedcurve' || shape === 'bezier') {
                if (self.getDrawingPointCount() === 1) {
                    $(self.map.getWrapper()).bind("mousemove", self, self.drawingMove);
                    $(self.map.getWrapper()).bind("dblclick", self, self.drawingDblclick);
                } else {
                    var tempShape = new jxLine(self.getDrawingPoint(-2), self.getDrawingPoint(-1), pen, brush);
                    self.tempDraw(tempShape, true);
                }
            }
        },

        drawingMove: function (e) {
            var self = e.data;
            var pos = self.map.getMapPosFromMouseEvent(event);
            var point = self.newPointByPos(pos);
            var pen = self.drawingOptions.pen;
            var brush = self.drawingOptions.brush;
            var options = self.getDrawingOptions();
            var shape = options.shape.toLowerCase();
            var tempShape;
            var lastPoint = self.getDrawingLastPoint();
            if (shape === "line" || shape === 'polyline' || shape === 'polygon' || shape === 'curve' || shape === 'closedcurve' || shape === 'bezier') {
                tempShape = new jxLine(lastPoint, point, pen);
            } else if (shape === "rect") {
                tempShape = new jxRect(lastPoint, point, pen, brush);
            } else if (shape === 'circle') {
                tempShape = new jxCircle(lastPoint, point, pen, brush);
            } else if (shape === 'ellipse') {
                tempShape = new jxEllipse(lastPoint, point, pen, brush);
            }
            self.tempDraw(tempShape);
        },
        drawingDblclick: function (e) {
            var self = e.data;
            self.endDrawing();
            $(self.map.getWrapper()).unbind("dblclick", self.drawingDblclick);
        },
        startDrawing: function () {
            $(this.map.getWrapper()).bind("mouseup", this, this.drawingClick);
        },
        endDrawing: function () {
            var self = this;
            var _shape = self.drawingOptions.shape.toLowerCase();
            var shape;
            var pen = self.drawingOptions.pen;
            var brush = self.drawingOptions.brush;
            if (_shape === 'line') {
                shape = new jxLine(self.drawingPoints[0], self.drawingPoints[1], pen);
            } else if (_shape === 'rect') {
                shape = new jxRect(self.drawingPoints[0], self.drawingPoints[1], pen, brush);
            } else if (_shape === 'polyline') {
                shape = new jxPolyline(self.getDrawingPoints(), pen, brush);
            } else if (_shape === 'polygon') {
                shape = new jxPolygon(self.getDrawingPoints(), pen, brush);
            } else if (_shape === 'circle') {
                shape = new jxCircle(self.getDrawingPoint(-2), self.getDrawingPoint(-1), pen, brush);
            } else if (_shape === 'ellipse') {
                shape = new jxEllipse(self.getDrawingPoint(-2), self.getDrawingPoint(-1), pen, brush);
            } else if (_shape === 'curve') {
                shape = new jxCurve(self.getDrawingPoints(), pen, brush);
            } else if (_shape === 'closedcurve') {
                shape = new jxClosedCurve(self.getDrawingPoints(), pen, brush);
            } else if (_shape === 'bezier') {
                shape = new jxBezier(self.getDrawingPoints(), pen, brush);
            }

            self.draw(shape);
            this.drawingOptions.afterDrawing.apply(this, [shape, self]);
            self.cleanDrawing();
        },
        cleanDrawing: function () {
            $(this.map.getWrapper()).unbind("mousemove", this.drawingMove);
            $(this.map.getWrapper()).unbind("mouseup", this.drawingClick);

            for (var i in this.tempShapes) {
                this.currentGraph.removeShape(this.tempShapes[i]);
                this.tempShapes[i].remove();
            }
            if (this.tempShape) {
                this.currentGraph.removeShape(this.tempShape);
                this.tempShape.remove();
            }
            this.tempShapes.length = 0;
            this.drawingPoints.length = 0;
            this.drawingOptions = {};
            this.tempShape = null;
            this.drawing = false;
            this.map.setMode(0);
        },
        addMapPoint: function (event) {
            var pos = this.map.getMapPosFromMouseEvent(event);
            var point = this.newPointByPos(pos);
            var lastPoint = this.getDrawingLastPoint();
            if (lastPoint && lastPoint.x == point.x && lastPoint.y == point.y) {
                return null;
            }
            this.drawingPoints[this.drawingPoints.length] = point;
            return point;
        },
        getDrawingLastPoint: function () {
            return this.drawingPoints[this.drawingPoints.length - 1];
        },
        getDrawingPoint: function (pos) {
            if (pos >= 0) {
                return this.drawingPoints[pos];
            } else {
                return this.drawingPoints[this.drawingPoints.length + pos];
            }
        },
        // copy the array to solve the reference problem.
        getDrawingPoints: function () {
            var newArr = new Array();
            for (var i = 0; i <= this.drawingPoints.length - 1; i++) {
                var p = this.drawingPoints[i];
                newArr.push(p);
            }
            return newArr;
        },
        getDrawingPointCount: function () {
            return this.drawingPoints.length;
        },
        getDrawingOptions: function () {
            return this.drawingOptions;
        },
        newColor: function () {
            return new jxColor(arguments);
        },
        newPointByGPS: function (lat, lon) {
            var pos = this.map.makePos(lat, lon);
            var pixel = this.map.getPixelPosFromMapPos(pos);
            var point = new jxPoint(pixel.x, pixel.y);
            point.pos = pos;
            point.lat = lat;
            point.lon = lon;
            point.replace = function (map) {
                var pixel = map.getPixelPosFromMapPos(this.pos);
                this.x = pixel.x;
                this.y = pixel.y;
            };
            return point;
        },
        newPointByPos: function (pos) {
            var pixel = this.map.getPixelPosFromMapPos(pos);
            var point = new jxPoint(pixel.x, pixel.y);
            point.pos = pos;
            point.lat = pos.getLatitude();
            point.lon = pos.getLongitude();
            point.replace = function (map) {
                var pixel = map.getPixelPosFromMapPos(this.pos);
                this.x = pixel.x;
                this.y = pixel.y;
            };
            return point;
        }
    };

    /**
     * Position
     * @type {Position}
     */
    emap.PositionINDEX = 0;
    emap.Position = function (posX, posY) {
        this.posX = posX;
        this.posY = posY;
        this.id = "MapPosition_" + emap.PositionINDEX++;
    };

    emap.Position.prototype = {
        getId: function () {
            return this.id;
        },
        getPosX: function () {
            return this.posX;
        },
        getPosY: function () {
            return this.posY;
        },
        getLatitude: function () {
            if (this.posY >= 0 && this.posY <= 1) {
                return emap.setting.posToLatLon(this.posX, this.posY).lat;
            }
        },
        getLongitude: function () {
            return emap.setting.posToLatLon(this.posX, this.posY).lon;
        },
        getLatLonString: function () {
            return this.getLatitude() + "," + this.getLongitude();
        },
        toString: function () {
            return this.posX + "," + this.posY;
        }
    };

    /**
     * ImageTile
     * @constructor
     */
    emap.ImageTile = function () {
        var img = document.createElement("img");
        this._tileX = 0;
        this._tileY = 0;
        this._zoom = 0;
        $(img).css({
            position: "absolute",
            width: emap.tilePixel + "px",
            height: emap.tilePixel + "px",
            "-moz-user-select": "none",
            "-webkit-user-select": "none",
            "-ms-user-select": "none",
            "-khtml-user-select": "none",
            "user-select": "none"
        });
        img.unselectable = "on";
        this._image = img;
    };
    emap.ImageTile.prototype = {
        addToLayer: function (layer, tileX, tileY, zoom, left, top, edgeNum) {
            this._layer = layer;
            this._tileX = tileX;
            this._tileY = tileY;
            this._zoom = zoom;
            this._edgeNum = edgeNum;
            layer.getWrapper().appendChild(this._image);
            this.moveTo(left, top);
        },
        moveTo: function (left, top) {
            this._left = left;
            this._top = top;
            this._image.style.left = (left) + "px";
            this._image.style.top = (top) + "px";
        },
        offsetPos: function (offsetX, offsetY) {
            this.moveTo(this._left + offsetX, this._top + offsetY);
        },
        destroy: function () {
            this.clear();
            if (this._layer) {
                this._layer = null;
            }
            emap.TileStore.returnImageTile(this);
        },
        draw: function () {
            var imageSrc;
            if (this._tileX >= 0 && this._tileX < this._edgeNum && this._tileY >= 0 && this._tileY < this._edgeNum) {
                imageSrc = this._layer.getTileUrl(this._tileX, this._tileY, this._zoom);
            }
            if (!imageSrc) {
                imageSrc = emap.setting.getEmptyImgSrc();
            }

            var tileX = this._tileX;
            var tileY = this._tileY;
            var tile = this;

            this._image.onload = function (event) {
                if (tile._tileX === tileX && tile._tileY === tileY) {
                    tile._image.style.display = "block";
                }
            };

            this._image.onerror = function (event) {
            };
            try {
                this._image.src = imageSrc;
            } catch (e) {
            }
        },
        clear: function () {
            this._layer.getWrapper().removeChild(this._image);
        }
    };


    emap.Marker = function (options) {
        this.defaults = {lat: 0, lon: 0, icon: "", hoverIcon: "", label: "marker", showLabel: true, status: "show", width: 20, height: 30};
        options = $.extend(this.defaults, options);
        emap.utils.extend(this, options);
        this.id = "emap_marker_" + emap.Marker.INDEX++;
        this.wrapper = $("<div class='emap-marker'></div>")[0];

        this.pos = emap.setting.makePos(this.lat, this.lon);

        $(this.wrapper).css({
            position: "absolute",
            cursor: "pointer",
            "z-index": 10,
            width: options.width + "px",
            height: options.height + "px"
        });
        this.setIcon(this.icon);


        var self = this;
        $(this.wrapper).hover(function () {
            self.doHover();
        }, function () {
            self.deHover();
        });
    };

    emap.Marker.INDEX = 0;

    emap.Marker.prototype = {
        getWrapper: function () {
            return this.wrapper;
        },
        setIcon: function (icon) {
            if (icon) {
                $(this.wrapper).css("background", "url(" + icon + ")");
            }
        },
        doHover: function () {
            this.setIcon(this.hoverIcon);
        },
        deHover: function () {
            this.setIcon(this.icon);
        },
        setMap: function (map) {
            this.map = map;
            this.show();
        },
        bindEvent: function (type, data, event) {
            $(this.wrapper).bind(type, data, event);
        },
        show: function () {
            var size = this.map.getSize();
            var edgeLen = this.map.getEdgeLen();
            var mapCenterPos = this.map.getMapCenterPos();
            var px = size.width / 2 + edgeLen * (this.pos.posX - mapCenterPos.posX) - this.map.getLayerContainer().getLayerOffset()[0] - this.width / 2;
            var py = size.height / 2 + edgeLen * (this.pos.posY - mapCenterPos.posY) - this.map.getLayerContainer().getLayerOffset()[1] - this.height / 2;

            $(this.wrapper).css({
                left: px + "px",
                top: py + "px"
            });

            if (this.showLabel) {
                if (this.labelSpan) {
                    $(this.labelSpan).css({
                        left: ( this.width - 10) + "px",
                        top: ( this.height - 10  ) + "px"
                    });
                } else {
                    this.labelSpan = $('<span class="emap-marker-label"></span>').html(this.label).css({
                        position: "absolute",
                        cursor: "pointer",
                        left: ( this.width - 10) + "px",
                        top: ( this.height - 10  ) + "px"
                    });
                    $(this.wrapper).append(this.labelSpan);
                }
            }
        }
    };


    /**
     *
     */
    emap.TileStore = (function () {
        return {
            imageTileStore: [],
            mapTileStore: [],
            getImageTile: function () {
                var tile = this.imageTileStore.pop();
                if (!tile) {
                    tile = new emap.ImageTile();
                }
                return tile;
            },
            returnImageTile: function (tile) {
                if (tile) {
                    this.imageTileStore.push(tile);
                }
            }
        };
    })();

    emap.DragEventHandler = function (map) {
        this.map = map;
    };

    emap.DragEventHandler.prototype = {
        bind: function () {
            var that = this;
            $(this.map.getWrapper()).bind("mousedown", function (event) {
                if (that.map.getMode() === 0) {
                    that.mouseDown.call(that, event);
                }
            });
        },
        mouseDown: function (event) {
            var actionDiv = this.map.getWrapper();
            var leftButton = emap.isIE && emap.browser.version < 9 ? 1 : 0;
            if (event.button != leftButton) {//只能左键，屏蔽右键的拖动
                return;
            }
            if (emap.isIE) {
                event.preventDefault();
            }
            var layerContainer = this.map.getLayerContainer();
            var layerOffset = layerContainer.getLayerOffset();
            var initDivX = layerOffset[0];
            var initDivY = layerOffset[1];
            var timeY = 0, timeZ = 0, draggingTimeOffset = 0;//last three event time,use to check mouse drag speed
            var timeYPosX = 0, timeYPosY = 0, timeZPosX = 0, timeZPosY = 0;
            var pageX = emap.utils.getPageX(event),
                pageY = emap.utils.getPageY(event),
                tmpX, tmpY;


            var draggingDiv = function (event) {
                var layerOffset = layerContainer.getLayerOffset();
                if (event.stopPropagation) {
                    event.stopPropagation();
                    event.preventDefault();
                } else {//IE
                    event.cancelBubble = true;
                    event.returnValue = false;
                }
                if (actionDiv) {
//                    actionDiv.style.cursor = "move";
                }
                var tx = emap.utils.getPageX(event);
                var ty = emap.utils.getPageY(event);
                timeZ = (new Date()).getTime();
                draggingTimeOffset = timeZ - timeY;
                timeY = timeZ;

                timeYPosX = timeZPosX;
                timeYPosY = timeZPosY;
                timeZPosX = tx;
                timeZPosY = ty;

                if (tmpX == tx && tmpY == ty) {

                } else {
                    tmpX = tx;
                    tmpY = ty;
                    var xx = tx - pageX + initDivX - layerOffset[0];
                    var yy = ty - pageY + initDivY - layerOffset[1];
                    event.data.movingMap(xx, yy);
                }
            };

            var droppedDiv = function (event) {
                var layerOffset = layerContainer.getLayerOffset();
                if (actionDiv) {
//                    actionDiv.style.cursor = "default";
                }
                $('body').off('mousemove');
                $('body').off('mouseup');
                var tx = emap.utils.getPageX(event);
                var ty = emap.utils.getPageY(event);

                timeZ = (new Date()).getTime();
                draggingTimeOffset = timeZ - timeY;
                timeZPosX = tx;
                timeZPosY = ty;
                if (draggingTimeOffset > 0 && draggingTimeOffset < 20) {
                    event.data.doAfterDragMove((timeZPosX - timeYPosX), (timeZPosY - timeYPosY));
                } else {
                    var xx = tx - pageX + initDivX - layerOffset[0];
                    var yy = ty - pageY + initDivY - layerOffset[1];
                    event.data.movedMap(xx, yy);
                }
            };

            $('body').off('mousemove').on("mousemove", this, draggingDiv);
            $('body').off("mouseup").on("mouseup", this, droppedDiv);
        },
        movedMap: function (pixelX, pixelY) {
            this.map.moveToCenterPos(pixelX, pixelY);
        },
        movingMap: function (pixelX, pixelY) {

            this.map.movingCenterPos(pixelX, pixelY);
        },
        doAfterDragMove: function (offsetPosX, offsetPosY) {
            var stepNum = 50;
            var stepX = offsetPosX * 5 / stepNum;
            var stepY = offsetPosY * 5 / stepNum;
            var index = 0;
            var self = this;

            function offset() {
                self.movingMap(stepX, stepY);
                index++;
                if (index >= stepNum) {
                    if (interval) {
                        clearInterval(interval);
                        interval = null;
                        self.movedMap(0, 0);
                    }
                }
            }

            var interval = setInterval(offset, 1);
        }
    };

    emap.WheelEventHandler = function (map) {
        this.map = map;
        this.interval = emap.isIE ? 200 : 0;
        this.lastWheelTime = 0;
    };

    emap.WheelEventHandler.prototype = {
        bind: function () {
            var that = this;
            $(this.map.getWrapper()).bind("mousewheel", function (event, delta) {
                that.mouseWheel.call(that, event, delta);
            });
        },
        mouseWheel: function (event, delta) {
            if (event.stopPropagation) {
                event.stopPropagation();
                event.preventDefault();
            } else {//IE
                event.cancelBubble = true;
                event.returnValue = false;
            }
            var currWheelTime = new Date().getTime();
            if (Math.abs(currWheelTime - this.lastWheelTime) > 200) {
                this.lastWheelTime = currWheelTime;
            } else {
                return;
            }
            var newZoom = this.map.getZoom();
            if (delta === -1) {
                newZoom--;
                this._isZoomUp = true;
            } else if (delta === 1) {
                newZoom++;
                this._isZoomUp = false;
            }
            if (!emap.isValidZoom(newZoom)) {
                return;
            }
            var mousePixel = this.map.getMousePixel(event);
            if (this.interval) {
                var self = this;
                if (!this._timeoutId) {
                    this._timeoutId = window.setTimeout(
                        function () {
                            self.doWheel(mousePixel.x, mousePixel.y, newZoom);
                            //                        this.wheelZoom(e);
                        },
                        this.interval
                    );
                }
            } else {
                this.doWheel(mousePixel.x, mousePixel.y, newZoom);
            }
        },
        doWheel: function (pixelX, pixelY, newZoom) {
            window.clearTimeout(this._timeoutId);
            this._timeoutId = null;

            this.map.zoomToMapCenter(pixelX, pixelY, newZoom);
        }
    };

    emap.ClickEventHandler = function (map) {
        this.map = map;
    };

    emap.ClickEventHandler.prototype = {
        bind: function () {
            var that = this;
            $(this.map.getWrapper()).bind("mousedown", function (event) {
                if (that.map.getMode() === 0) {
                    that.mouseDown.call(that, event);
                }
            });
            $(this.map.getWrapper()).bind("click", function (event) {
                that.onClick.call(that, event);
            });
        },
        mouseDown: function (event) {
            this.mouseDownPos = [event.offsetX, event.offsetY];
        },
        onClick: function (event) {
            if (this.mouseDownPos) {
                var mapPos = this.map.getMapPosFromMouseEvent(event);
                this.map.fireEvent(emap.events.MAP_CLICK, [mapPos]);
            }
        }
    };

    emap.DetailZoomControl = function (map, styles) {
        this.map = map;
        var wrapper = $('<div class="emap-detail-zoom-control"></div>')[0];


        this.defaults = {
            "zIndex": 1010,
            "position": "absolute",
            "top": "10px",
            "left": "20px",
            "width": "45px",
            "-moz-user-select": "none",
            "-webkit-user-select": "none",
            "user-select": "none"
        };

        var styles = $.extend(this.defaults, styles);
        $(wrapper).css(styles);

        this.moveControl = $('<div class="control-move"></div>').appendTo(wrapper);
        this.moveUp = $('<div class="control-move-up"></div>').appendTo(wrapper);
        this.moveRight = $('<div class="control-move-right"></div>').appendTo(wrapper);
        this.moveDown = $('<div class="control-move-down"></div>').appendTo(wrapper);
        this.moveLeft = $('<div class="control-move-left"></div>').appendTo(wrapper);

        this.zoomControl = $('<div class="control-move-center"></div>').appendTo(wrapper);
        this.zoomRuler = $('<div class="control-zoom-ruler"></div>').appendTo(wrapper);
        this.zoomUp = $('<div class="control-zoom-up"></div>').appendTo(wrapper);
        this.zoomDown = $('<div class="control-zoom-down"></div>').appendTo(wrapper);
        this.zoomSlider = $('<div class="control-zoom-slider"></div>').appendTo(wrapper);
        this.zoomLabel = $('<span class="control-zoom-label"></span>').appendTo(wrapper);

        this.wrapper = wrapper;
        $(this.wrapper).find("div").bind("click", this.map, this.onClick);
        this.resetSlider();
        var self = this;
        this.map.addEventListener(emap.events.ZOOM_END, function(){
            self.resetSlider();
        });
    };

    emap.DetailZoomControl.TAG = "Emap_DetailZoomControl";

    emap.DetailZoomControl.prototype = {
        TAG: "Emap_DetailZoomControl",
        getWrapper: function () {
            return this.wrapper;
        },
        resetSlider: function () {
            var zoom = this.map.getZoom();
            if (!zoom && zoom !== 0) {
                return;
            }
            var newY = this.getZoomLabelYPos(zoom);
            $(this.zoomLabel).html(zoom).css("top", (newY - 3) + "px");
            $(this.zoomSlider).css("top", newY + "px");
        },
        getZoomLabelYPos: function (zoom) {
            return (90 * (emap.setting.LIMIT_MAX_ZOOM - zoom) / (emap.setting.LIMIT_MAX_ZOOM - emap.setting.LIMIT_MIN_ZOOM) + 80);
        },
        onClick: function (event) {
            if (event.stopPropagation) {
                event.stopPropagation();
                event.preventDefault();
            } else {
                event.cancelBubble = true;
                event.returnValue = false;
            }
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                event.cancelBubble = true;
            }
            var map = event.data;
            if ($(event.target).hasClass("control-move-up")) {
                map.moveToCenterPos(0, 200)
            } else if ($(event.target).hasClass("control-move-down")) {
                map.moveToCenterPos(0, -200)
            } else if ($(event.target).hasClass("control-move-left")) {
                map.moveToCenterPos(200, 0)
            } else if ($(event.target).hasClass("control-move-right")) {
                map.moveToCenterPos(-200, 0)
            } else if ($(event.target).hasClass("control-move-center")) {
                var defaultPos = map.makePos(map.lat, map.lon);
                var pixelX = ( map.getMapCenterPos().posX - defaultPos.posX ) * map.getEdgeLen();
                var pixelY = ( map.getMapCenterPos().posY - defaultPos.posY ) * map.getEdgeLen();
                map.moveToCenterPos(pixelX, pixelY);
            } else if ($(event.target).hasClass("control-zoom-up")) {
                map.zoomChange(map.getZoom() + 1);
            } else if ($(event.target).hasClass("control-zoom-down")) {
                map.zoomChange(map.getZoom() - 1);
            }
        }
    };


    emap.MapMeasureControl = function (map) {
        this.map = map;
        var wrapper = $('<div class="emap-measure-control"></div>');
        $(wrapper).css({
            "zIndex": 1020,
            "position": "absolute",
            "top": "10px",
            "left": "20px",
            "width": "45px",
            "-moz-user-select": "none",
            "-webkit-user-select": "none",
            "user-select": "none"
        });
        this.currentGraph = null;
        this.graphStore = {};
        this.wrapper = wrapper;
        var self = this;

    };

    emap.MapMeasureControl.TAG = "Emap_MeasureControl";

    emap.MapMeasureControl.prototype = {
        TAG: "Emap_MeasureControl",
        getWrapper: function () {
            return this.wrapper;
        },
        onMouseUp: function (event) {
            if (this.map.getMode() !== 1) {
                return;
            }
            var leftButton = emap.isIE && emap.browser.version < 9 ? 1 : 0;
            if (event.button != leftButton) {//只能左键，屏蔽右键的拖动
                return;
            }
            if (event.stopPropagation) {
                event.stopPropagation();
                event.preventDefault();
            } else {
                event.cancelBubble = true;
                event.returnValue = false;
            }
            this.addMapPoint(event);
        },
        addMapPoint: function (event) {
            if (!event) {
                return;
            }
            var self = event.data;
            var pos = self.map.getMapPosFromMouseEvent(event);

        },
        begin: function () {
            this.map.mapContainer.style.cursor = "crosshair";
            this.map.setMode(1);
            var self = this;

            function onMouseMove(event) {
                if (self.map.getMode() !== 1) {
                    return;
                }
                if (event.stopPropagation) {
                    event.stopPropagation();
                    event.preventDefault();
                } else {
                    event.cancelBubble = true;
                    event.returnValue = false;
                }
                var size = self.map.getSize();
                var tx = event.pageX;
                var ty = event.pageY;
                var offsetX = 0, offsetY = 0;
                if (tx < 0) {
                    offsetX = -1;
                } else if (tx >= size.width) {
                    offsetX = 1;
                }
                if (ty < 0) {
                    offsetY = -1;
                } else if (ty > size.height) {
                    offsetY = 1;
                }

                if (offsetX !== 0 || offsetY !== 0) {
                    self.startMoving(offsetX, offsetY);
                } else {
                    self.stopMoving();
                }

                var pos = self.map.getMapPosFromPixelPos(offsetX, offsetY);
                var dashMapLine = self.dashMapLine;
                if (dashMapLine) {
                    if (dashMapLine.getPosCount() === 1) {
                        dashMapLine.addPos(pos);
                    } else {
                        dashMapLine.changeLastPos(pos);
                    }
                }
            }

            this.onMouseMove = onMouseMove;
        }
    };

    emap.utils = (function () {
        return {
            rMsie: /(msie\s|trident.*rv:)([\w.]+)/,
            rFirefox: /(firefox)\/([\w.]+)/,
            rOpera: /(opera).+version\/([\w.]+)/,
            rChrome: /(chrome)\/([\w.]+)/,
            rSafari: /version\/([\w.]+).*(safari)/,
            uaMatch: function () {
                var ua = navigator.userAgent.toLowerCase();
                var match = this.rMsie.exec(ua);
                if (match != null) {
                    return { browser: "IE", version: match[2] || "0" };
                }
                match = this.rFirefox.exec(ua);
                if (match != null) {
                    return { browser: match[1] || "", version: match[2] || "0" };
                }
                match = this.rOpera.exec(ua);
                if (match != null) {
                    return { browser: match[1] || "", version: match[2] || "0" };
                }
                match = this.rChrome.exec(ua);
                if (match != null) {
                    return { browser: match[1] || "", version: match[2] || "0" };
                }
                match = this.rSafari.exec(ua);
                if (match != null) {
                    return { browser: match[2] || "", version: match[1] || "0" };
                }
                if (match != null) {
                    return { browser: "", version: "0" };
                }
            },
            getPageX: function (event) {
                if (event.pageX || event.pageY) {
                    return event.pageX;
                } else {
                    return event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                }
            },
            getPageY: function (event) {
                if (event.pageX || event.pageY) {
                    return event.pageY;
                } else {
                    return event.clientY + document.documentElement.scrollTop;
                }
            },
            removeItem: function (array, item) {
                var k = array.length;
                if (k <= 0) {
                    return;
                }
                while (k--) {
                    if (array[k] === item) {
                        array.splice(k, 1);
                        break;
                    }
                }
            },
            extend: function (dest, src) {
                for (var prop in src) {
                    dest[prop] = src[prop];
                }
                return dest;
            },
            bindEvent: function (elementTarget, eventType, func) {
                if (window.addEventListener) {
                    elementTarget.addEventListener(eventType, func, false);
                } else if (window.attachEvent) {
                    elementTarget.attachEvent("on" + eventType, func);
                }
            },
            unbindEvent: function (elementTarget, eventType, func) {
                if (window.addEventListener) {
                    elementTarget.removeEventListener(eventType, func, false);
                } else if (window.attachEvent) {
                    elementTarget.detachEvent("on" + eventType, func);
                }
            }
        };
    })();

    window.emap = emap;
})(window);


/*! Copyright (c) 2013 Brandon Aaron (http://brandon.aaron.sh)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Version: 3.1.12
 *
 * Requires: jQuery 1.2.2+
 */

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS style for Browserify
        module.exports = factory;
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    var toFix = ['wheel', 'mousewheel', 'DOMMouseScroll', 'MozMousePixelScroll'],
        toBind = ( 'onwheel' in document || document.documentMode >= 9 ) ?
            ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'],
        slice = Array.prototype.slice,
        nullLowestDeltaTimeout, lowestDelta;

    if ($.event.fixHooks) {
        for (var i = toFix.length; i;) {
            $.event.fixHooks[ toFix[--i] ] = $.event.mouseHooks;
        }
    }

    var special = $.event.special.mousewheel = {
        version: '3.1.12',

        setup: function () {
            if (this.addEventListener) {
                for (var i = toBind.length; i;) {
                    this.addEventListener(toBind[--i], handler, false);
                }
            } else {
                this.onmousewheel = handler;
            }
            // Store the line height and page height for this particular element
            $.data(this, 'mousewheel-line-height', special.getLineHeight(this));
            $.data(this, 'mousewheel-page-height', special.getPageHeight(this));
        },

        teardown: function () {
            if (this.removeEventListener) {
                for (var i = toBind.length; i;) {
                    this.removeEventListener(toBind[--i], handler, false);
                }
            } else {
                this.onmousewheel = null;
            }
            // Clean up the data we added to the element
            $.removeData(this, 'mousewheel-line-height');
            $.removeData(this, 'mousewheel-page-height');
        },

        getLineHeight: function (elem) {
            var $elem = $(elem),
                $parent = $elem['offsetParent' in $.fn ? 'offsetParent' : 'parent']();
            if (!$parent.length) {
                $parent = $('body');
            }
            return parseInt($parent.css('fontSize'), 10) || parseInt($elem.css('fontSize'), 10) || 16;
        },

        getPageHeight: function (elem) {
            return $(elem).height();
        },

        settings: {
            adjustOldDeltas: true, // see shouldAdjustOldDeltas() below
            normalizeOffset: true  // calls getBoundingClientRect for each event
        }
    };

    $.fn.extend({
        mousewheel: function (fn) {
            return fn ? this.bind('mousewheel', fn) : this.trigger('mousewheel');
        },

        unmousewheel: function (fn) {
            return this.unbind('mousewheel', fn);
        }
    });


    function handler(event) {
        var orgEvent = event || window.event,
            args = slice.call(arguments, 1),
            delta = 0,
            deltaX = 0,
            deltaY = 0,
            absDelta = 0,
            offsetX = 0,
            offsetY = 0;
        event = $.event.fix(orgEvent);
        event.type = 'mousewheel';

        // Old school scrollwheel delta
        if ('detail'      in orgEvent) {
            deltaY = orgEvent.detail * -1;
        }
        if ('wheelDelta'  in orgEvent) {
            deltaY = orgEvent.wheelDelta;
        }
        if ('wheelDeltaY' in orgEvent) {
            deltaY = orgEvent.wheelDeltaY;
        }
        if ('wheelDeltaX' in orgEvent) {
            deltaX = orgEvent.wheelDeltaX * -1;
        }

        // Firefox < 17 horizontal scrolling related to DOMMouseScroll event
        if ('axis' in orgEvent && orgEvent.axis === orgEvent.HORIZONTAL_AXIS) {
            deltaX = deltaY * -1;
            deltaY = 0;
        }

        // Set delta to be deltaY or deltaX if deltaY is 0 for backwards compatabilitiy
        delta = deltaY === 0 ? deltaX : deltaY;

        // New school wheel delta (wheel event)
        if ('deltaY' in orgEvent) {
            deltaY = orgEvent.deltaY * -1;
            delta = deltaY;
        }
        if ('deltaX' in orgEvent) {
            deltaX = orgEvent.deltaX;
            if (deltaY === 0) {
                delta = deltaX * -1;
            }
        }

        // No change actually happened, no reason to go any further
        if (deltaY === 0 && deltaX === 0) {
            return;
        }

        // Need to convert lines and pages to pixels if we aren't already in pixels
        // There are three delta modes:
        //   * deltaMode 0 is by pixels, nothing to do
        //   * deltaMode 1 is by lines
        //   * deltaMode 2 is by pages
        if (orgEvent.deltaMode === 1) {
            var lineHeight = $.data(this, 'mousewheel-line-height');
            delta *= lineHeight;
            deltaY *= lineHeight;
            deltaX *= lineHeight;
        } else if (orgEvent.deltaMode === 2) {
            var pageHeight = $.data(this, 'mousewheel-page-height');
            delta *= pageHeight;
            deltaY *= pageHeight;
            deltaX *= pageHeight;
        }

        // Store lowest absolute delta to normalize the delta values
        absDelta = Math.max(Math.abs(deltaY), Math.abs(deltaX));

        if (!lowestDelta || absDelta < lowestDelta) {
            lowestDelta = absDelta;

            // Adjust older deltas if necessary
            if (shouldAdjustOldDeltas(orgEvent, absDelta)) {
                lowestDelta /= 40;
            }
        }

        // Adjust older deltas if necessary
        if (shouldAdjustOldDeltas(orgEvent, absDelta)) {
            // Divide all the things by 40!
            delta /= 40;
            deltaX /= 40;
            deltaY /= 40;
        }

        // Get a whole, normalized value for the deltas
        delta = Math[ delta >= 1 ? 'floor' : 'ceil' ](delta / lowestDelta);
        deltaX = Math[ deltaX >= 1 ? 'floor' : 'ceil' ](deltaX / lowestDelta);
        deltaY = Math[ deltaY >= 1 ? 'floor' : 'ceil' ](deltaY / lowestDelta);

        // Normalise offsetX and offsetY properties
        if (special.settings.normalizeOffset && this.getBoundingClientRect) {
            var boundingRect = this.getBoundingClientRect();
            offsetX = event.clientX - boundingRect.left;
            offsetY = event.clientY - boundingRect.top;
        }

        // Add information to the event object
        event.deltaX = deltaX;
        event.deltaY = deltaY;
        event.deltaFactor = lowestDelta;
        event.offsetX = offsetX;
        event.offsetY = offsetY;
        // Go ahead and set deltaMode to 0 since we converted to pixels
        // Although this is a little odd since we overwrite the deltaX/Y
        // properties with normalized deltas.
        event.deltaMode = 0;

        // Add event and delta to the front of the arguments
        args.unshift(event, delta, deltaX, deltaY);

        // Clearout lowestDelta after sometime to better
        // handle multiple device types that give different
        // a different lowestDelta
        // Ex: trackpad = 3 and mouse wheel = 120
        if (nullLowestDeltaTimeout) {
            clearTimeout(nullLowestDeltaTimeout);
        }
        nullLowestDeltaTimeout = setTimeout(nullLowestDelta, 200);

        return ($.event.dispatch || $.event.handle).apply(this, args);
    }

    function nullLowestDelta() {
        lowestDelta = null;
    }

    function shouldAdjustOldDeltas(orgEvent, absDelta) {
        // If this is an older event and the delta is divisable by 120,
        // then we are assuming that the browser is treating this as an
        // older mouse wheel event and that we should divide the deltas
        // by 40 to try and get a more usable deltaFactor.
        // Side note, this actually impacts the reported scroll distance
        // in older browsers and can cause scrolling to be slower than native.
        // Turn this off by setting $.event.special.mousewheel.settings.adjustOldDeltas to false.
        return special.settings.adjustOldDeltas && orgEvent.type === 'mousewheel' && absDelta % 120 === 0;
    }

}));

