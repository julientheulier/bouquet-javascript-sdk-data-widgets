(function (root, factory) {
    root.squid_api.view.DataExport = factory(root.Backbone, root.squid_api);
}(this, function (Backbone, squid_api) {

    View = Backbone.View.extend( {

        template : null,
        renderTo: null,
        compression : true,
        downloadStatus : 0,
        curlCollapsed : true,
        currentJobId : null,
        displayInAccordion : false,
        viewPort : null,
        formats : [{"format" : "csv", "mime-type" : "text/csv", "template" : null}],
        selectedFormatIndex : 0,
        templateData : null,
        displayScripting : true,
        displayCompression : true,
        
        initialize : function(options) {
            if (this.model.get("analysis")) {
                this.listenTo(this.model.get("analysis"), 'change', this.render);
                this.listenTo(this.model, 'change:templateData', this.refreshDownloadUrl);
            } else {
                this.listenTo(this.model, 'change', this.render);
            }
            // setup options
            if (options.template) {
                this.template = options.template;
            } else {
                this.template = squid_api.template.squid_api_export_widget;
            }
            if (options.formats) {
                this.formats = options.formats;
            }
            if (options.renderTo) {
                this.renderTo = options.renderTo;
            }
            if (options.displayInAccordion !== false) {
                this.displayInAccordion = true;
                this.viewPort = this.renderTo;
            } else {
                this.viewPort = this.$el;
            }
            if (options.displayScripting === false) {
                this.displayScripting = false;
            }
            if (options.displayCompression === false) {
                this.displayCompression = false;
            }
            this.render();
        },

        setModel : function(model) {
            this.model = model;
            this.initialize();
        },
        
        clickedFormat : function (event) {
            var t = event.target;
            this.selectedFormatIndex = null;
            for (var i=0; i<this.formats.length;i++) {
                if (this.formats[i].format === t.value) {
                    this.selectedFormatIndex = i;
                }
            }
            this.refreshDownloadUrl();
        },
        
        clickedCompression : function (event) {
            var t = event.target;
            this.compression = (t.checked);
            this.refreshDownloadUrl();
        },

        refreshDownloadUrl : function() {
            var me = this;
            if (me.currentJobId) {
                // create download link
                var analysisJobResults;
                var selectedFormat = this.formats[this.selectedFormatIndex];
                if (!selectedFormat.template) {
                    // use getResults method
                    analysisJobResults = new squid_api.model.ProjectAnalysisJobResult();
                    analysisJobResults.addParameter("format",selectedFormat.format);
                } else {
                    // use render method
                    analysisJobResults = new squid_api.model.ProjectAnalysisJobRender({"format" : selectedFormat.format});
                    analysisJobResults.setParameter("type", selectedFormat.type);
                    analysisJobResults.setParameter("timeout", null);
                    // build the template
                    var velocityTemplate = selectedFormat.template(me.model.get("templateData"));
                    analysisJobResults.setParameter("template", base64.encode(velocityTemplate));
                }
                if (me.compression) {
                    analysisJobResults.addParameter("compression","gzip");
                }
                analysisJobResults.set({
                    "id": me.currentJobId,
                    "oid": me.currentJobId.oid
                });
                var downloadBtn = $(me.viewPort).find("#download");
                downloadBtn.attr("href",analysisJobResults.url());
                downloadBtn.removeClass("disabled");
            }
        },
        
        render : function() {
            var me = this;
            var analysis = this.model.get("analysis");
            if (!analysis) {
                analysis = this.model;
            }
            
            var selectedFormat = this.formats[this.selectedFormatIndex];
            var formatsDisplay = [];
            for (var i=0; i<this.formats.length;i++) {
                formatsDisplay[i] = this.formats[i];
                if (i === this.selectedFormatIndex) {
                    formatsDisplay[i].selected = true;
                }
            }
            
            if (this.displayInAccordion) {
                this.$el.html("<button type='button' class='btn btn-open-export-panel' data-toggle='collapse' data-target=" + this.renderTo + ">Export<span class='glyphicon glyphicon-download-alt'></span></button>");
                var facets = analysis.get("facets");
                var metrics = analysis.get("metrics");
                if ((!facets || facets.length === 0) && (!metrics || metrics.length === 0)) {
                    $("button.btn-open-export-panel").prop('disabled', true);
                } else {
                    $("button.btn-open-export-panel").prop('disabled', false);
                }
            }

            var data, curl, curlFileName;
            if (me.displayScripting !== false) {
                // render the curl snippet
                var exportAnalysis = new squid_api.model.ProjectAnalysisJob();
                exportAnalysis.addParameter("format", this.formats[this.selectedFormatIndex].format);
                if (this.compression) {
                    exportAnalysis.addParameter("compression","gzip");
                }
                exportAnalysis.addParameter("access_token","[access_token]");
                exportAnalysis.set(analysis.attributes);
                exportAnalysis.set(
                   "id", {
                        "projectId": analysis.get("id").projectId,
                        "analysisJobId": null
                    });
    
                // escape all spaces in the json injected into cURL
                data = JSON.stringify(exportAnalysis).replace(/\'/g, '\\\'');
                curlFileName = "analysis";
                if (selectedFormat.format) {
                    curlFileName += "."+selectedFormat.format;
                }
                if (this.compression) {
                    curlFileName += ".gz";
                }
                curl = exportAnalysis.url().replace(/\[access_token\]/g, '<b>[access_token]</b>');
            }
            
            $(this.viewPort).html(this.template({
                "displayInAccordion" : this.displayInAccordion,
                "data-target" : this.renderTo,
                "formats": formatsDisplay,
                "displayCompression" : this.displayCompression,
                "compression": (this.compression),
                "curl": curl,
                "curlFileName" : curlFileName,
                "origin": "https://api.squidsolutions.com",
                "data": data,
                "customerId" : squid_api.customerId,
                "clientId" : squid_api.clientId,
                "redirectURI":"https://api.squidsolutions.com",
                "apiURL":squid_api.apiURL
                })
            );
            
            // prepare download link
            this.downloadStatus = 1;
            var downloadBtn = $(me.viewPort).find("#download");
            downloadBtn.addClass("disabled");

            if (analysis.get("id").projectId) {
                var downloadAnalysis = new squid_api.model.ProjectAnalysisJob();
                downloadAnalysis.set(analysis.attributes);
                downloadAnalysis.set({
                    "id": {
                        "projectId": analysis.get("id").projectId,
                        "analysisJobId": null
                    },
                    "autoRun": false});
                squid_api.controller.analysisjob.createAnalysisJob(downloadAnalysis, analysis.get("selection"))
                .done(function(model, response) {
                    me.downloadStatus = 2;
                    me.currentJobId = downloadAnalysis.get("id");
                    me.refreshDownloadUrl();
                })
                .fail(function(model, response) {
                    console.error("createAnalysisJob failed");
                });
            }
            
            // apply cURL panel state
            if (me.curlCollapsed) {
                $(this.viewPort).find('#curl').hide();
            } else {
                $(this.viewPort).find('#curl').show();
            }
            
            // Click Handlers
            $(this.viewPort).find("#curlbtn").click(function() {
                me.curlCollapsed = !me.curlCollapsed;
                if (me.curlCollapsed) {
                    $(me.viewPort).find('#curl').fadeOut();      
                } else {
                    $(me.viewPort).find('#curl').fadeIn();
                }
            });

            // register click handlers    
            $(this.viewPort).find('[name="format"]').click(
                    function(event) {
                        me.clickedFormat(event);
                    });
            $(this.viewPort).find('[name="compression"]')
            .click(function(event) {
                me.clickedCompression(event);
            });

            return this;
        }
    });

    return View;
}));
