'use strict';

var _ = require('lodash');
var Model = require('backbone').Model;
var events = require('../lib/events');
var datahelper = require('../helpers/data');
var initialState = require('./initialState');
var dispatcher = require('../dispatcher');

/**
 * # Store
 *
 * This is primary data store for Data Lasso. It strives to
 * follow role prescribed to a store in a Flux pattern, containing the state
 * that is only changed by actions and never by anything else.
 *
 * Views listen for changes in this Store, and never should modify it directly.
 *
 * In it's essence, it is a singleton Backbone model that both provides storage and
 * a mechanism for communicating changes to a store downstream.
 *
 * Benefit of the dispatcher: No simultaneous execution.
 */

var DataModel = Model.extend({

    defaults: initialState,

    initialize: function () {
        dispatcher.register(_.bind(this.dispatchCallback, this));
    },

    /**
     * # Dispatcher Callback
     *
     * Receives actions coming down from a dispatcher and mutates state accordingly.
     *
     * @param action {object} - Action dispatched with a dispatcher. Always has an `actionType`.
     */
    dispatchCallback: function (action) {
        switch (action.actionType) {
            case 'options-set':
                this.options = action.options;
                break;

            case 'file-uploaded':
                this.onFileUpload(action);
                break;

            case 'selection-started':
                this.onSelectionStart();
                break;

            case 'selection-stopped':
                this.onSelectionStop();
                break;

            case 'selection-made':
                this.onNewSelection(action);
                break;

            case 'axis-mappings-updated':
                this.onNewMappings(action);
                break;

            case 'entry-hovered':
                this.set({focused: action.entry});
                break;

            case 'zoom-in':
                this.onZoomIn();
                break;

            case 'zoom-out':
                this.onZoomOut();
                break;
        }
    },

    /**
     * New data was uploaded. Parse it to get attributes and scales.
     */
    onFileUpload: function (action) {
        var data = datahelper.processInput(action.entries, this.options);
        this.set({
            entries: data.entries,
            attributes: data.attributes,
            scales: data.scales,
            snapshots: [],
        });
    },

    /**
     * New selection started (user started using a selection tool).
     */
    onSelectionStart: function () {
        this.set({
            mode: 'selection',
            controls: false,
        });
    },

    /**
     * Selection has stopped, or selection was finished.
     */
    onSelectionStop: function () {
        this.set({
            mode: 'normal',
            controls: true,
        });
    },

    /**
     * New axis mappings were selected for the visualization
     */
    onNewMappings: function (action) {
        this.set({
            mappings: action.mappings,
            scales: datahelper.getUpdatedScales(this.get('entries'), this.options)
        });
    },

    /**
     * New selection was made
     */
    onNewSelection: function (action) {
        var selectedEntries = action.selectedEntries;
        var entries = _.transform(this.get('entries'), function (result, entry) {
            entry.isSelected = (selectedEntries.indexOf(entry.__id) >= 0);
            result.push(entry);
        });

        this.set({
            entries: entries,
            selectedEntries: selectedEntries
        });
    },

    /**
     * Selection is zoomed into
     */
    onZoomIn: function () {
        var newEntries = _.transform(this.get('entries'), function(result, entry) {
            if (entry.isSelected) {
                entry.isSelected = false;
                result.push(entry);
            }
        });

        this.saveDataSnapshot();
        this.set({
            entries: newEntries,
            selectedEntries: [],
            scales: datahelper.getUpdatedScales(newEntries, this.options)
        })
    },

    /**
     * Selection is zoomed out of
     */
    onZoomOut: function () {
        this.restoreLastDataSnapshot();
    },

    /**
     * Preserve current state that will be changed by zooming in in a snapshot
     */
    saveDataSnapshot: function () {
        var snapshots = this.get('snapshots') || [];
        snapshots.push(_.pick(this.toJSON(), ['entries', 'mappings', 'scales', 'attributes', 'selectedEntries']));
        this.set({
            snapshots: snapshots
        });
    },

    /**
     * Get last snapshot and use it
     */
    restoreLastDataSnapshot: function () {
        var snapshots = this.get('snapshots');
        var lastSnapshot = snapshots.pop();
        this.set({
            entries: lastSnapshot.entries,
            mappings: lastSnapshot.mappings,
            scales: lastSnapshot.scales,
            attributes: lastSnapshot.attributes,
            selectedEntries: lastSnapshot.selectedEntries,
            snapshots: snapshots,
        });
    },
});

module.exports = new DataModel();
