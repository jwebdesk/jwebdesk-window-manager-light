define([
    "jwebkit",
    "jwebkit.ui",
    "jwebdesk",
], function(jwk, ui, jwebdesk) {

    // jwk.ui.Panel.Layout --------------------------------------------------------------------------
    jwebdesk.WindowManager = function (settings) {
        if (!settings) return;
// alert("jwebdesk.WindowManager");    
        var def = {
            ui_type: "window-manager",
            namespace: "jwebdesk",
            layout: ["content"]
        };
        settings = jwk.extend(def, settings);
        jwk.ui.Component.call(this, settings);
        this.set("start", "row");
        this.set("layout", settings.layout, {no_parse:true});
        this.set("window", {}, { getter: "child" });
        this.on("render_start", function (n,e){
            e.component.restructure();
        });        
    }
    
    jwebdesk.WindowManager.prototype = new jwk.ui.Component();
    jwebdesk.WindowManager.prototype.constructor = jwebdesk.WindowManager;

    jwebdesk.WindowManager.prototype.create_service = function () {
        var service = jwk.global.proxy();
        var win_man = this;
        win_man.service = service;
        
        service.register_function({
            create: win_man.create,
            min_mode: win_man.min_mode,
            list: win_man.list,
            select: win_man.select_window,
            minimize: win_man.minimize_window,
            maximize: win_man.maximize_window,
            restore: win_man.restore_window,
            close: win_man.close_window
        }, this);
        
        var handle_F5 = function () {
            console.log("handle_F5", arguments);
            var selected = win_man.get_selected();
            console.log(selected);            
            if (selected) {
                selected.reload();
            } else {
                window.location.reload();
            }            
        };
        
        // shortcut.add("F5", handle_F5);

        jwebdesk.register_service("window-manager", service);
        
    }
    
    function on_select_handler(n,e) {
        this.set("selected", this.window(e.window));
    }
    
    jwebdesk.WindowManager.prototype.get_selected = function () {
        return this.get("selected");
    }

    jwebdesk.WindowManager.prototype.select_hiest_window = function (win_id, params) {
        var z_best = -1;
        var win_best = null;
        var list = this.window().keys();
        for (var i=0; i<list.length; i++) {
            var id = list[i];
            var win =this.window(id);
            if (win.component && win.component.get("state") != "minimized" && win.component.target && win.component.target.css("z-index")) {
                if (parseInt(win.component.target.css("z-index")) > z_best) {
                    z_best = parseInt(win.component.target.css("z-index"));
                    win_best = win;                    
                }
            }
        }

        if (win_best) win_best.component.select();        
    }
    
    jwebdesk.WindowManager.prototype.select_window = function (win_id, params) {
        this.window(win_id).component.select();
    }
    
    jwebdesk.WindowManager.prototype.minimize_window = function (win_id, params) {
        var manager = this;
        this.window(win_id).component.minimize().done(function () {
            manager.select_hiest_window();
        });        
    }
    
    jwebdesk.WindowManager.prototype.maximize_window = function (win_id, params) {
        this.window(win_id).component.maximize();
    }
    
    jwebdesk.WindowManager.prototype.restore_window = function (win_id, params) {
        var win = this.window(win_id).component;
        var state = win.get("state");
        if (state == "minimized") {
            win.restore();
        } else if (state == "maximized") {
            win.normal();
        } else {
            console.error("ERROR: window.restore from state: ", win.state(), "not implemented", win, win_id);
        }
    }
    
    jwebdesk.WindowManager.prototype.close_window = function (win_id, params) {
        this.window(win_id).component.close();
        this.select_hiest_window();
    }
    
    jwebdesk.WindowManager.prototype.min_mode = function (win_id, params) {
        this.window(win_id).component.set("min_mode", params);
    }
    
    jwebdesk.WindowManager.prototype.list = function (win_id, params) {
        var list = [];        
        this.window().each(function (w) {
            var win = w.valueOf();
            list.push({ window: win.id, title: win.title, icon: win.icon, category: win.setup.category });
        });
        return list;
    }
    
    jwebdesk.WindowManager.prototype.create = function (setup, restaure_settings) {
        if (setup instanceof jwebdesk.Setup) {
            var win = new jwebdesk.WindowManager.Window(setup, restaure_settings);
            // console.log("create ----", setup.valueOf(), win.id(), win.valueOf());            
            this.window(win.id, win);
            var event = { setup: setup.id, window: win.id, title: win.title, icon: win.icon };
            
            this.service.trigger("window:open", event);
            
            win.on("close",     function (n,e) {
                this.unset("selected");
                this.service.trigger("window:close",    event);
                this.window().unset(win.id);
                this.select_hiest_window();
            }, this);
            win.on("select", on_select_handler, this);            
            win.component.on("minimize",  function (n,e) {
                this.service.trigger("window:minimize", event);
                this.select_hiest_window();
            }, this);
            win.component.on("maximize",  function (n,e) { this.service.trigger("window:maximize", event); }, this);
            win.component.on("restore",   function (n,e) { this.service.trigger("window:restore",  event); }, this);
            win.component.on("select",    function (n,e) { this.service.trigger("window:select",   event); }, this);
            
            if (!restaure_settings) {
                // Esto significa que la aplicación 
                if (win.layer == "window") {
                    if (win.component.controllers.selectable) {                    
                        win.component.controllers.selectable.select();
                    }                
                }                
            }
            
            return win;
        } else {
            console.error(setup, "¿?");
        }
    }
    
    /*
    jwebdesk.WindowManager.prototype.structure_tree = function () {
        var root =  {
            "data": this,
            "name": "structure",
            "ui_type": "panel.placeholder",
            "children": {
                "desk": {
                    "start": this.get("start"),
                    "layout": this.get("layout"),
                    "class": "full",                    
                    "ui_type": "panel.layout",
                    "children": {
                        "west":       { "class":"expand window-manager-west",       "ui_type": "panel" },
                        "top":        { "class":"expand window-manager-top",        "ui_type": "panel" },
                        "left":       { "class":"expand window-manager-left",       "ui_type": "panel" },
                        "content":    { 
                            "ui_type": "panel",
                            "disable_selection": true,
                            "class":"full window-manager-content",
                            "style": "position: absolute; left:0;right:0;"
                        },
                        "right":      { "class":"expand window-manager-right",      "ui_type": "panel" },
                        "bottom":     { "class":"expand window-manager-bottom",     "ui_type": "panel" },
                        "east":       { "class":"expand window-manager-east",       "ui_type": "panel" },
                    }
                }
            }
        }
        
        var containers = root.children.desk.children;
        var string = JSON.stringify(this.get("layout"));
        for (var name in containers) {
            if (string.indexOf(name) == -1) {
                delete containers[name];
            }
        }
       
        return root;
    }*/

    
    jwebdesk.WindowManager.prototype.hide = function (name) {
        console.error("ERROR: not jwebdesk.WindowManager.hide(name) not implemented yet");
    }
    
    /*
    jwebdesk.WindowManager.prototype.show = function (name) {
        var layout = this.get("layout");
        var level_1, level_2, level_3;
        level_1 = layout;
        for (var i in level_1) {
            if (Array.isArray(level_1[i])) level_2 = level_1[i];
        }
        if (!level_2) {
            level_3 = layout;
            level_2 = [level_3];
            level_1 = [level_2];
        } else {
            for (var i in level_2) {
                if (Array.isArray(level_2[i])) level_3 = level_2[i];
            }
            if (!level_3) {
                level_3 = level_2;
                level_2 = level_1;
                level_1 = [level_2];
            }            
        }
        
        switch (name) {
            case "west":
                if (level_1[0] != name) level_1.splice(0,0,name); break;
            case "top":
                if (level_2[0] != name) level_2.splice(0,0,name); break;
            case "left":
                if (level_3[0] != name) level_3.splice(0,0,name); break;
            case "right":
                if (level_3[level_3-1] != name) level_3.splice(level_3-1,0,name); break;
            case "bottom":
                if (level_2[level_2-1] != name) level_2.splice(level_2-1,0,name); break;
            case "east":
                if (level_1[level_1-1] != name) level_1.splice(level_1-1,0,name); break;
        }
        
        var start;
        if (level_1.length > 1) {
            start = "row";
            layout = level_1;
            
        } else {
            if (level_2.length > 1) {
                start = "col";
                layout = level_2;
            } else {
                start = "row";
                layout = level_3;
            }
        }
        // if (this.get("structure")) this.get("structure").destroy();
        // this.unset("structure");
        this.set("start", start);
        this.set("layout", layout, {no_parse: true});
        
        this.paint();
    }
    */
    
    jwebdesk.WindowManager.prototype.parent_for = function (name, index) {
        switch (name) {
            case "desk":                
            case "structure":
                return {parent:this};
        }
        return {parent:this.get("structure").search("content")};    
    }
    
    jwk.ui.component({
        ui_type: "window-manager",
        namespace: "jwebdesk",
        constructor: jwebdesk.WindowManager
    });
    
// -----------------------------------------------------------------------------------------------------------------------    
    
    jwebdesk.WindowManager.Window = function (setup, restore_settings) {
        jwk.Node.call(this);
        this.set("setup", setup);
        var win = this;
        var windex;
        if (restore_settings && restore_settings.windex) {
            windex = restore_settings.windex;
        } else {
            windex = setup.windex();
        }        
        win.windex = windex;
                
        // TODO: sele limina el theme y queda solo config.window
        // Puede que no estén todos los datos. Si algo falta setear valores por defecto
        // Si la posición y tamaño de la ventana no están presentes, generar un par adecuados sgun el estado actual de las ventanas.        
        var window_config = setup.config["window_" + windex];
        if (!window_config) {
            window_config = setup.get("config.theme.window", {deep: true});
            if (window_config) {
                alert("ERROR: Hay que cambiar el path 'config.theme.window' del setup: "+ setup.get("id"));
                console.error("ERROR: Hay que cambiar el path 'config.theme.window' del setup: ", [setup.get("id"),setup]);
            }
        }
        if (!window_config) window_config = new jwk.Node();
        
        var settings = setup.get("settings");
        if (settings) settings = settings.valueOf();
        settings = jwk.extend({
            "layers": ["window"],
            "resizable": true,
            "draggable": true,
            "selectable": true
        }, settings);
        
        var layers = settings.layers;
        var layer = window_config.get("layer");
        if (!layers) {
            // console.error("ERROR: settings.layers not found:",[setup.get("id"), setup]);
            layers = ["window"];
        }
        console.assert(Array.isArray(layers) && layers.length > 0, "ERROR: layers must be an Array with at least one string indicating the possible layers");
        if (!layer) {         
            layer = layers[0];
        }        
        if (layers.indexOf(layer) == -1) {
            console.error("ERROR: layer (" +layer+ ") must be one of possible layers: ", layers);
            layer = layers[0];
        }
        
        this.layer = layer;
        window_config = jwk.extend(window_config.valueOf(), {layer: layer}, settings);
        
        switch (layer) {
            case "window":
                window_config.size = window_config.size || {
                    "width": "70%",
                    "height": "70%"
                }
                window_config.position = window_config.position || {
                    "my": "center center",
                    "at": "center center",
                    "of": "container"
                }
                
                // window-selection-group fix
                if (window_config.selectable == true) {
                    window_config.selectable = { group: "jwebdesk-window" }
                }
                var name = "window_" + jwk.nextId();
                var settings = jwk.extend({
                    path: name,
                    name: name,
                    parent: this.manager
                }, window_config);                
                var spec = jwk.ui.component("jwk-ui", "window");
                this.component =  new spec.constructor(settings);
                this.component._win = win;
                this.component.init();
                this.component.paint();
                if (restore_settings && restore_settings.zindex) this.zindex(restore_settings.zindex);
                
                // TODO: Acá hay que ver como setear en el nuevo dato en las config de la aplicación
                this.component.on({
                    "resize": function (n,e) { win.trigger(n,jwk.extend({}, e, { window: win, component: e.window})); },
                    "move":   function (n,e) { win.trigger(n,jwk.extend({}, e, { window: win, component: e.window})); },
                    "state":  function (n,e) { win.trigger(n,jwk.extend({}, e, { window: win, component: e.window})); }
                }, this);
                break;
            case "west":
            case "top":
            case "left":
            case "right":
            case "bottom":
            case "east":
                //this.manager.show(layer);
                //this.component = this.manager.search(layer);                
                console.error("not implemented. layer:", layer);
                break;
        }
        
        this.set("id", "win-"+jwk.nextId()); 
        this.set("title", setup.get("title") || "No title"); 
        this.set("icon", "app"); // TODO: unhardcode icon
        
        this.component.on("destroy", function (n,e){
            console.assert(this.component == e.component, this, this.component, e.component);
            // console.error("----------------",n,e);
            this.trigger_fast("close", {window: this.id});            
        }, this);
        
        if (this.component.controllers.selectable) {
            this.component.controllers.selectable.on("select", function (n,e){
                console.assert(this.component == e.component, this, this.component, e.component);
                this.trigger_fast("select", {window: this.id});
            }, this);
        }
        
        
    }
    
    jwebdesk.WindowManager.Window.prototype = new jwk.Node();
    jwebdesk.WindowManager.Window.prototype.constructor = jwebdesk.WindowManager.Window;
    
    function add_packages(arr, packs){
        // console.log("add_packages", arguments);
        console.assert(Array.isArray(arr), arr);
        switch (typeof packs) {
            case "string":                
                if (packs != "default-skin") {
                    arr.push(packs);
                }                
                break;
            case "object":
                var list = packs.valueOf();
                if (Array.isArray(list)) {
                    for (var i in list) {
                        var obj = list[i];
                        if (typeof obj == "string") {
                            if (arr.indexOf(list[i]) == -1) {
                                arr.push(list[i]);
                            }
                        } else if (typeof obj == "object") {
                            // no se agrega porque se supone que el Setup lo va a saber interpretar como json y no como nombre de paquete
                        }
                    }
                }
                break;
            default:
                console.error("????", arguments);
        } 
        return arr;
        
    }
    
    jwebdesk.WindowManager.Window.prototype.maximize = function () {
        console.assert(this.component, "ERROR: not component instantiated", [this]);        
        this.component.maximize();
    }
    
    jwebdesk.WindowManager.Window.prototype.minimize = function () {
        console.assert(this.component, "ERROR: not component instantiated", [this]);        
        this.component.minimize();
    }
    
    jwebdesk.WindowManager.Window.prototype.restore = function () {
        console.assert(this.component, "ERROR: not component instantiated", [this]);        
        this.component.restore();
    }    
    
    jwebdesk.WindowManager.Window.prototype.fullcanvas = function () {
        console.assert(this.component, "ERROR: not component instantiated", [this]);        
        this.component.fullcanvas();
    }    
    
    jwebdesk.WindowManager.Window.prototype.zindex = function (value) {
        var win = this;
        if (arguments.length == 1) {
             win.component.target.css("z-index", value); 
        } else {
            return win.component.target.css("z-index");
        }
        return this.load();
    }
    
    jwebdesk.WindowManager.Window.prototype.reload = function () {
        var win = this;
        if (this.application) delete this.application;
        return this.load();
    }
    
    jwebdesk.WindowManager.Window.prototype.load = function (params) {
        var df = jwk.Deferred();
        var setup = this.get("setup");
        var component = this.component;
        var win = this;
        if (win.proxy) return df.resolve(win, win.proxy._proxy_id, setup.get("name")).promise();
        
        if (setup.category == "hud") {
            console.assert(setup.package, setup);
            var req_list = [];
            req_list.push(setup.package.id);          
            if (setup.config.skin) req_list = add_packages(req_list, setup.config.skin);
            if (setup.config.plugins) req_list = add_packages(req_list, setup.config.plugins);
            
            jwebdesk.repository.require(req_list).done(function () {
                var ui_type =  setup.package.ui_type;
                var namespace = setup.package.namespace;
                win.application = jwk.ui.display_component({
                    "name": ui_type,
                    "parent": component,
                    "ui_type": ui_type,
                    "namespace": namespace                    
                });
                win.proxy = win.application.get_proxy();
                win.proxy.instance = win.application; // esto es temporal (tengo al lounchbar y sus  plugins agarrados de esto)
                df.resolve(win, win.proxy._proxy_id, setup.get("id"));
            });
            
            if (params && params.fullcanvas) console.error("ERROR: open_app fullcanvas only for 'app' category pacakes. " + setup.id + " is category 'hud'." );
        }
        
        if (setup.category == "app") {
            var req_list = [setup.get("packid")];
            if (setup.get("package.id", {deep: true})) {
                req_list.push(setup.package.id);
            }
            if (setup.config.skin) req_list = add_packages(req_list, setup.config.skin);
            if (setup.config.plugins) req_list = add_packages(req_list, setup.config.plugins);
            
            var app_url = setup.get("url");
            var url = jwebdesk.serverURL+"?package="+encodeURIComponent(JSON.stringify(req_list))
            if (params) {
                url += "&params="+encodeURIComponent(JSON.stringify(params));
            }
            
            if (app_url) {
                if (app_url.indexOf("/") == 0) {
                    app_url = jwebdesk.appsURL + app_url;                    
                }
                url = url + (url.indexOf("?") > 0 ? "&" : "?") + "url="+encodeURIComponent(app_url);
            }
            
            // TODO: habría que debugear esta parte:
            // Es posible que un setup tenga req_list no vacío y a la vez una url ? alguien hace un assert al respecto?        
// console.log("jwebdesk.WindowManager.Window.prototype.load()", "jwk.global._listeners.iframe:", [jwk.global._listeners.iframe]);
            var iframe = component.search("iframe");
            if (iframe) {
                iframe.set("url", url, true);                
            } else {
                iframe = jwk.ui.display_component({
                    "name": "iframe",
                    "url": url,
                    "parent": component,
                    "ui_type": "panel.iframe",
                    "namespace": "jwk-ui"                
                });
            }
            
            component.onbeforeclose = function () {
                // console.log("onbeforeclose");
                if (iframe.proxy && typeof iframe.proxy.onbeforeclose == "function") {
                    return iframe.proxy.onbeforeclose();
                }
            }
            
            iframe.on("change:proxy", function(n,e) {                    
                var proxy = e.value;
                proxy.register_function({
                    close: function () {
                        component.onbeforeclose = null;
                        component.close();
                        return true;
                    }
                });
                
                var menubar = component.search("menubar");
                proxy.register_function({
                    add_menu:               function () { menubar.add_menu.apply               (menubar, arguments); },
                    add_menu_item:          function () { menubar.add_menu_item.apply          (menubar, arguments); },
                    remove_menu:            function () { menubar.remove_menu.apply            (menubar, arguments); },
                    remove_menu_item:       function () { menubar.remove_menu_item.apply       (menubar, arguments); },
                    set_menu_title:         function () { menubar.set_menu_title.apply         (menubar, arguments); },
                    set_menu_item_shortcut: function () { menubar.set_menu_item_shortcut.apply (menubar, arguments); },
                    set_menu_item_state:    function () { menubar.set_menu_item_state.apply    (menubar, arguments); },
                    set_menu_item:          function () { menubar.set_menu_item.apply          (menubar, arguments); },
                });
                                
                function propague_command_event(n,e){                    
                    proxy.trigger("command", {command: e.command});
                }                
                menubar.off("command", propague_command_event, win);
                menubar.on("command", propague_command_event, win);                
            });
            
            iframe.one("change:proxy", function(n,e) {                
                // console.error(n,e);
                df.resolve(win, e.value._proxy_id, setup.get("name"));
            });
            
            if (params && params.fullcanvas) {
                win.wait_flag("rendered").done(function() {
                })
            }
            
            if (app_url) {
                // the application may not be using jwk.global so iframe.one("change:proxy") event may never occur;
                setTimeout(function (){                    
                    if (df.state() == "pending") {
                        df.resolve(win, null, setup.get("name"));
                    }                    
                }, 2000);
            }
            
        }
        
        return df.promise();
    }
    
    jwebdesk.wait_flag("ready").done(function (){
        if (!jwebdesk.service("window-manager")) {

            var win_man = jwk.ui.create_component({
                "name": "window-manager",
                "ui_type": "window-manager",
                "namespace": "jwebdesk"
            });
            win_man.paint();

            jwebdesk.WindowManager.Window.prototype.manager = win_man;
            win_man.create_service();
            return win_man;        
        }
    })
  
});
    
//  requirejs(["apps/jwebdesk/hud/window-manager"]);