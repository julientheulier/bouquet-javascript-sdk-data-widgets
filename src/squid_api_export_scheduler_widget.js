(function (root, factory) {
    root.squid_api.view.DataExportScheduler = factory(root.Backbone, root.squid_api);
}(this, function (Backbone, squid_api) {

    View = Backbone.View.extend( {
        template : null,
        indexView : null,
        exportJobModel : null,
        exportJobCollection : null,
        schedulerApiUri : null,
        exportJobs : null,
        hiddenFields : null,

        initialize : function(options) {
            widget = this;

            // setup options
            if (options) {
                if (options.template) {
                    this.template = options.template;
                } else {
                    this.template = squid_api.template.squid_api_export_scheduler_widget;
                }
                if (options.schedulerApiUri) {
                    this.schedulerApiUri = options.schedulerApiUri;
                }
                if (options.hiddenFields) {
                    this.hiddenFields = options.hiddenFields;
                }
            }

            this.indexView = squid_api.template.squid_api_export_scheduler_index_view;

            exportJobModel = Backbone.Model.extend({
                urlRoot : this.schedulerApiUri + "/jobs",
                idAttribute: "_id",
                url: function() {
                  var base =
                    _.result(this, 'urlRoot') ||
                    _.result(this.collection, 'url') ||
                    urlError();
                    if (this.isNew()) return base+"?access_token=" + squid_api.model.login.get("accessToken");
                    var id = this.get(this.idAttribute);
                    return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id)+"?access_token=" + squid_api.model.login.get("accessToken");
                }
            });

            exportJobCollection = Backbone.Collection.extend({
                model: exportJobModel,
                urlRoot : this.schedulerApiUri,
                url: function() {
                    var url = this.urlRoot + "/jobs/";
                    url = url + "?access_token=" + squid_api.model.login.get("accessToken");
                    return url;
                }
            });

            exportJobs = new exportJobCollection();

            // listeners
            this.listenTo(squid_api.model.login, "change:accessToken", this.fetchAndRender);
            this.render();
        },

        events: {
            "click button" : "renderIndex"
        },

        fetchAndRender : function() {
            exportJobs.fetch();
        },

        renderIndex: function() {
            var me = this;
            var indexView = Backbone.View.extend({
                model: exportJobs,
                initialize: function() {
                    this.template = squid_api.template.squid_api_export_scheduler_index_view;
                    this.listenTo(exportJobs, "reset change remove sync", this.render);
                    this.render();
                },
                events: {
                    "click .create-job": function() {
                        widget.renderForm();
                    },
                    "click .edit-job": function(event) {
                        var id = $(event.target).parents(".job-item").attr("data-attr");
                        widget.renderForm(id);
                    },
                    "click .run-job": function(event) {
                        var id = $(event.target).parents(".job-item").attr("data-attr");
                        var url = me.schedulerApiUri + "/jobs/" + id + "?run=1&access_token=" + squid_api.model.login.get("accessToken");
                        $.ajax({
                            method: "GET",
                            url: url,
                        });
                    },
                    "click .delete-job": function(event) {
                        var id = $(event.target).parents(".job-item").attr("data-attr");
                        var job = exportJobs.get(id);
                        job.destroy({
                            success: function() {
                                squid_api.model.status.set("message", "job successfully deleted");
                            },
                            error: function() {

                            }
                        });
                        exportJobs.remove(job);
                    }
                },
                render: function() {
                    var jsonData = {"jobs": []};
                    for (i=0; i<this.model.models.length; i++) {
                        jsonData.jobs.push(this.model.models[i].toJSON());
                    }
                    this.$el.html(this.template(jsonData));

                    this.$el.find(".table").DataTable({
                        paging: false
                    });
                    return this;
                }
            });
            this.indexModal = new Backbone.BootstrapModal({
                content: new indexView(),
                title: "Jobs"
            }).open();
        },

        getSchema: function() {
            return $.ajax({
                url: this.schedulerApiUri + "/Schema/?access_token=" + squid_api.model.login.get("accessToken"),
            });
        },

        renderForm: function(id) {
            this.getSchema().then(function(data) {
                if (id) {
                    model = exportJobs.where({"_id" : id})[0];
                } else {
                    model = new exportJobModel();
                }

                // construct schema ignoring hidden fields
                var schema = {};
                for (var x in data) {
                    if (widget.hiddenFields.indexOf(x) == -1) {
                        schema[x] = {};
                        schema[x].editorClass = "form-control";
                        if (data[x].instance == "Date") {
                           schema[x].type = "Date";
                        } else if (data[x].instance == "Array") {
                           schema[x].type = "List";
                           schema[x].itemType = "Text";
                        } else {
                           schema[x].type = "Text";
                        }
                    }
               }

                widget.formContent = new Backbone.Form({
                    schema: schema,
                    model: model
                });

                var formView = Backbone.View.extend({
                    initialize: function() {
                        this.render();
                    },
                    render: function() {
                        this.$el.html(widget.formContent.render().el);
                        return this;
                    }
                });
                var formModal = new Backbone.BootstrapModal({
                    content: new formView(),
                    title: "Jobs Form"
                }).open();

                formModal.on('ok', function (event) {
                        // the form is used in create and edit mode.
                        var values = widget.formContent.getValue();

                        // manipulate data
                        values.customerId = squid_api.model.customer.get("id");
                        values.userId = squid_api.model.login.get("userId");
                        values.shortcutId = squid_api.model.config.get("report");

                  if (id) {
                    // EDIT aka PUT /jobs/:id
                    var job = exportJobs.get(id);
                    job.set(values);
                    job.save();

                  } else{
                    // CREATE aka POST /jobs/
                    var newJob = new exportJobModel(values);
                    newJob.save({}, {
                        success: function(model) {
                            var msg = "";
                            if (model.get("errors")) {
                                var errors = model.get("errors");
                                for (var x in errors) {
                                    msg = msg + errors[x].message + "<br />";
                                }
                            } else {
                                exportJobs.add(model);
                                msg = msg + "job successfully saved";
                            }
                            squid_api.model.status.set("message", msg);
                        }
                    });
                  }

                });

            });
        },

        render : function() {
            // static view
            var html = this.template();
            this.$el.html(html);
        }
    });

    return View;
}));
