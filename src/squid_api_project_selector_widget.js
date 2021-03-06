(function (root, factory) {
    root.squid_api.view.ProjectSelector = factory(root.Backbone, root.squid_api, squid_api.template.squid_api_project_selector_widget);

}(this, function (Backbone, squid_api, template) {

    var View = Backbone.View.extend({
        template : null,
        projects : null,
        onChangeHandler: null,
        projectManipulateRender: null,
        dropdownClass: null,
        projectAutomaticLogin: null,

        initialize: function(options) {
            var me = this;

            // setup options
            if (options.template) {
                this.template = options.template;
            } else {
                this.template = template;
            }
            
            if (options.onChangeHandler) {
                this.onChangeHandler = options.onChangeHandler;
            }
            if (options.projectManipulateRender) {
                this.projectManipulateRender = options.projectManipulateRender;
            }
            if (options.multiSelectView) {
                this.multiSelectView = options.multiSelectView;
            }
            if (options.projectAutomaticLogin) {
                this.projectAutomaticLogin = options.projectAutomaticLogin;
            }

            // init the projects
            if (options.projects) {
                this.projects = options.projects;
            } else {
                //init the projects
                this.projects = new squid_api.model.ProjectCollection();
            }
            this.projects.addParameter("deepread","1");
            this.projects.on("reset sync", this.render, this);
            squid_api.model.login.on('change:login', function(model) {
                if (model.get("login")) {
                    // fetch projects
                    me.projects.fetch({
                        success : function(model) {
                            console.log(model);
                        },
                        error : function(model) {
                            console.log(model);
                        }
                    });
                }
            });
      
            if (!this.model) {
                this.model = squid_api.model.config;
            }
            this.model.on("change:project", this.render, this);

            // if project edit element passed, render it's view
            if (this.projectManipulateRender) {
                this.model.on("change:project", this.editProjectViewRender, this);
                this.editProjectViewRender();
            }
        },

        events: {
            "change .sq-select": function(event) {
                if (this.onChangeHandler) {
                    this.onChangeHandler.call(this,event);
                } else {
                    // default behavior
                    var selectedOid = event.target.value || null;
                    this.model.set({
                        "project" : selectedOid,
                        "domain" : null
                    });
                }
            }
        },

        editProjectViewRender: function() {
            var me = this;

            if (this.projectEditView) {
                this.projectEditView.remove();
            }
            
            // get the project;
            var project = new squid_api.model.ProjectModel();
            project.id = {
                projectId : me.model.get("project")
            };
            project.fetch().then( function() {
                if (me.projectEditView) {
                    me.projectEditView.setModel(project);
                } else { 
                    me.projectEditView = new api.view.ModelManagementView({
                        el : $(me.projectManipulateRender),
                        model : project,
                        successHandler: function() {
                            if (me.projectAutomaticLogin) {
                                squid_api.model.config.set({
                                    "project" : this.get("id").projectId,
                                    "domain" : null
                                });
                            }
                        }
                    });
                }
            });

        },

        render: function() {
            if (this.projects) {
                // display
                 
                var project, jsonData = {"selAvailable" : true, "options" : [{"label" : "Select Project", "value" : "", "selected" : false}]};
    
                for (var i=0; i<this.projects.size(); i++) {
                    project = this.projects.at(i);
                    if (project) {
                        var selected = false;
                        if (project.get("oid") === this.model.get("project")) {
                            selected = true;
                        }
    
                        var displayed = true;
    
                        // do not display projects with no domains
                        if (!project.get("domains")) {
                            displayed = false;
                        }
    
                        if (displayed) {
                            var option = {"label" : project.get("name"), "value" : project.get("oid"), "selected" : selected};
                            jsonData.options.push(option);
                        }
                    }
                }
    
                var html = this.template(jsonData);
                this.$el.html(html);
                this.$el.show();
    
                // Initialize plugin
                if (this.multiSelectView) {
                    this.$el.find("select").multiselect();
                }
            }

            return this;
        }

    });

    return View;
}));
