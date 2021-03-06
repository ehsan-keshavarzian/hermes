(function() {
    'use strict';

    function LaborStatusCtrl(hermesService, $q, $routeParams, $location, $cookies, smoothScroll) {
        var vm = this;

        vm.errorMessage = null;
        vm.hostOwnerInput = null;
        vm.filterOwn = false;
        vm.fates = false;
        vm.queryInput = null;
        vm.hostnameInput = null;
        vm.filterFate = null;
        vm.selectedEventType = null;

        vm.laborData = null;
        vm.selected = [];
        vm.laborsPerQuest = {};
        vm.hostTags = null;
        vm.hostOwners = null;
        vm.throwableTypes = null;
        vm.allTypes = null;
        vm.allFates = null;
        vm.createInProgress = false;
        vm.limit = 10;
        vm.offset = 0;
        vm.totalLabors = 10;
        vm.createErrorMessage = null;
        vm.createSuccessMessage = null;
        vm.createEventsModal = false;

        vm.colors = ['#0071ce', '#72b6ec', '#cce6fa', '#f4faff'];

        vm.runFilter = runFilter;
        vm.getOpenLabors = getOpenLabors;
        vm.toggleSelect = toggleSelect;
        vm.selectAll = selectAll;
        vm.deselectAll = deselectAll;
        vm.filterOwnChanged = filterOwnChanged;
        vm.throwableEventTypesSelection = throwableEventTypesSelection;
        vm.filterFatesSelection = filterFatesSelection;
        vm.createEvents = createEvents;


        vm.selectOptions = {
            updateOn: 'default change blur',
            getterSetter: true,
            allowInvalid: true
        };

        // we track the "items per page" limit with cookies so grab any value we might have for this
        vm.limit = $cookies.get("pageLimit") ? $cookies.get("pageLimit") : 50;

        hermesService.getCurrentUser().then(function (user) {
            if (user) {
                vm.user = user;

                // if user passed a filter-by-owner query param, use it
                if ($routeParams.byOwner) {
                    vm.hostOwnerInput = $routeParams.byOwner;
                    vm.filterOwn = false;
                }

                // if the user went straight to this page without any params, lets
                // modify the search to only show their labors
                if (
                    $location.path() == "/v1/labors/"
                    && Object.keys($routeParams).length == 0
                ) {
                    vm.hostOwnerInput = vm.user;
                    vm.filterOwn = true;
                }

                getOpenLabors();
            } else {
                vm.errorMessages = "Cannot create a new quest if not authenticated.";
            }
        });

        if ($routeParams.byQuery) {
            vm.queryInput = $routeParams.byQuery;
        }

        if ($routeParams.host) {
            vm.hostnameInput = $routeParams.host;
        }

        hermesService.getFates().then(function(fates) {
            vm.allFates = [""];
            for (var idx in fates) {
                if (fates[idx].precedesIds.length != 0) {
                    vm.allFates.push(fates[idx]);
                }
            }
            vm.filterFate = vm.allFates[0];
            vm.fates = fates;
        });

        hermesService.getUserThrowableEventTypes().then(function(types) {
            vm.throwableTypes = types;
            vm.selectedEventType = vm.throwableTypes[0];
        });


        //////// FIXME: Move to some kind of control service ///////
        vm.limitOptions = {
            updateOn: 'default change blur',
            getterSetter: true,
            allowInvalid: true
        };

        function limitSetting(limit) {
            if (angular.isDefined(limit)) {
                vm.limit = limit;
                vm.offset = 0;
                $cookies.put('pageLimit', limit);
            } else {
                return "" + vm.limit;
            }
        }

        function limitValues() {
            return ['10', '20', '50', '100', 'ALL'];
        }

        function pageSetting(page) {
            if (angular.isDefined(page)) {
                if (!isNaN(vm.limit)) {
                    vm.offset = (page - 1) * vm.limit;
                } else {
                    vm.offset = 0;
                }
            } else {
                if (!isNaN(vm.limit)) {
                    return "" + (vm.offset / vm.limit + 1);
                } else {
                    return 1;
                }
            }
        }

        function pageFirst() {
            pageSetting(1);
        }

        function pagePrev() {
            var currentPage = parseInt(pageSetting());

            if (currentPage > 1) {
                pageSetting(currentPage - 1);
            }
        }

        function pageNext() {
            var currentPage = parseInt(pageSetting());
            var maxPage = Math.floor((vm.totalLabors - 1) / vm.limit) + 1;
            if (currentPage < maxPage) {
                pageSetting(currentPage + 1);
            }
        }

        function pageLast() {
            var maxPage = Math.floor((vm.totalLabors - 1) / vm.limit) + 1;
            pageSetting(maxPage);
        }

        function pageValues() {
            var maxPage = Math.floor((vm.totalLabors - 1) / vm.limit);
            var options = [];
            for (var i = 0; i <= maxPage; i++) {
                options.push("" + (i + 1));
            }

            return options;
        }

        vm.limitSetting = limitSetting;
        vm.limitValues = limitValues;
        vm.pageSetting = pageSetting;
        vm.pageFirst = pageFirst;
        vm.pagePrev = pagePrev;
        vm.pageNext = pageNext;
        vm.pageLast = pageLast;
        vm.pageValues = pageValues;

        ////////////////////////////////

        /**
         * Called when user selects the "show only my labors" checkbox
         */
        function filterOwnChanged() {
            if (vm.filterOwn) {
                if (vm.user) {
                    vm.hostOwnerInput = vm.user;
                } else {
                    vm.filterOwn = false;
                    vm.errorMessages = "Your username is unknown.";
                }
            }
        }

        /**
         * The getter/setter for event types
         */
        function throwableEventTypesSelection(selection) {
            if (angular.isDefined(selection)) {
                vm.selectedEventType = selection;
            } else {
                return vm.selectedEventType;
            }
        }

        function filterFatesSelection(selection) {
            if (angular.isDefined(selection)) {
                vm.filterFate = selection;
            } else {
                return vm.filterFate;
            }
        }

        function runFilter() {
            $routeParams.laborId = null;
            vm.offset = 0;
            getOpenLabors();
        }

        function laborSorter(labor1, labor2) {
            var a = parseInt(labor1.questId) || 0;
            var b = parseInt(labor2.questId) || 0;

            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            } else {
                return 0;
            }
        }

        function getOpenLabors() {
            vm.errorMessage = null;
            vm.selected = [];
            vm.laborData = null;

            var options = {};

            if (vm.hostOwnerInput) {
                options['filterByOwner'] = vm.hostOwnerInput;
                $location.search('byOwner', vm.hostOwnerInput, false);
            } else {
                $location.search('byOwner', null, false);
            }

            if (vm.queryInput) {
                options['filterByQuery'] = vm.queryInput;
                $location.search('byQuery', vm.queryInput, false);
            } else {
                $location.search('byQuery', null, false);
            }

            if (vm.filterFate) {
                options['filterByCategory'] = vm.filterFate.creationEventType.category;
                options['filterByState'] = vm.filterFate.creationEventType.state;
            }

            if (vm.hostnameInput) {
                options['filterByHostname'] = vm.hostnameInput;
                $location.search('host', vm.hostnameInput, false);
            }

            hermesService.getOpenLabors(options).then(function (data) {
                if (!data
                    || !data['labors']
                    || data['labors'].length == 0) {
                    vm.errorMessage = "No labors found matching criteria.  Please refine.";
                    return;
                }

                vm.laborData = data['labors'].sort(laborSorter);
                vm.limit = data['limit'] || vm.limit;
                vm.offset = data['offset'] || vm.offset;
                vm.totalLabors = data['totalLabors'] || vm.totalLabors;
                vm.laborsPerQuest = {};

                // find the labor requested and make that the selection
                var index = -1;
                for (var idx in vm.laborData) {
                    if (vm.laborData[idx]['id'] == $routeParams.laborId) {
                        index = idx;
                    }
                    var questId = vm.laborData[idx]['questId'];
                    if (questId in vm.laborsPerQuest) {
                        vm.laborsPerQuest[questId] = vm.laborsPerQuest[questId] + 1;
                    } else {
                        vm.laborsPerQuest[questId] = 1;
                    }
                }

                if ($routeParams.laborId && index == -1) {
                    vm.errorMessage = "Labor " + $routeParams.laborId +
                            " not found.  Perhaps the labor is completed," +
                            " invalid, or has been filtered out."
                } else {
                    // if index is -1, then they likely didn't specify an id
                    if (index == -1) index = 0;
                    if (!isNaN(vm.limit)) {
                        vm.offset = index - (index % vm.limit);
                    } else {
                        vm.offset = 0;
                    }
                }

                // finally, if we did request a labor, let's scroll to it
                if ($routeParams.laborId) {
                    setTimeout(function() {
                        var laborDiv = document.getElementById("l" + $routeParams.laborId);
                        smoothScroll(laborDiv, {
                            duration: 700,
                            easing: 'easeInOutQuad',
                            offset: 100
                        });
                    }, 100);
                }
                getHostTags();
            }).catch(function(error) {
                vm.errorMessage = "Could not load open labors!  Please try again later.";
            });
        }

        /**
         * Get tags associated with the hosts of the machines in vm.laborData
         */
        function getHostTags() {
            var hostnames = [];
            for (var idx in vm.laborData) {
                var labor = vm.laborData[idx];
                hostnames.push(labor['host']['hostname'])
            }

            hermesService.getHostTags(hostnames).then(function(data) {
                vm.hostTags = data;
            }).catch(function(error){
                vm.errorMessage = "Could not load host tags: " + error.statusText;
            });

            hermesService.getOwnerInformation(hostnames).then(function(data) {
                vm.hostOwners = data;
            }).catch(function(error) {
                vm.errorMessage = "Could not load host owners: " + error.statusText;
            })

        }

        /**
         * Toggle a labor selection
         * @param id id of the labor to select
         */
        function toggleSelect(id) {
            var idx = vm.selected.indexOf(id);
            if (idx != -1) {
                vm.selected.splice(idx, 1)
            } else {
                vm.selected.push(id);
            }
        }

        /**
         * Select all the labors on this screen and add them to the list
         * of selected labors
         */
        function selectAll() {
            if (vm.limit == "ALL") {
                for (var idx in vm.laborData) {
                    if (vm.selected.indexOf(vm.laborData[idx].id) == -1) {
                        vm.selected.push(vm.laborData[idx].id);
                    }
                }
            }
            for (var idx = parseInt(vm.offset);
                 idx < (parseInt(vm.offset) + parseInt(vm.limit));
                 idx++) {

                if (idx >= vm.laborData.length) {
                    break;
                }

                if (vm.selected.indexOf(vm.laborData[idx].id) == -1) {
                    vm.selected.push(vm.laborData[idx].id);
                }
            }
        }

         /**
         * Deselect all the labors on this screen and remove them to the list
         * of selected labors
         */
        function deselectAll() {
             if (vm.limit == "ALL") {
                 vm.selected = [];
             }
            for (var idx = parseInt(vm.offset);
                 idx < (parseInt(vm.offset) +  parseInt(vm.limit)); idx++) {

                if (idx >= vm.laborData.length) {
                    break;
                }

                var idy = vm.selected.indexOf(vm.laborData[idx].id);
                if (idy != -1) {
                    vm.selected.splice(idy, 1);
                }
            }
        }

        /**
         * Create events for the selected hosts
         */
        function createEvents() {
            if (vm.createInProgress) return;
            vm.createEventsModal = false;
            vm.createInProgress = true;
            vm.createErrorMessage = null;
            vm.createSuccessMessage = null;

            var hostnames = [];
            for (var idx in vm.laborData) {
                var labor_id = vm.laborData[idx].id;

                if (vm.selected.indexOf(labor_id) != -1) {
                    hostnames.push(vm.laborData[idx].host.hostname);
                }
            }

            vm.result = hermesService.createEvents(
                vm.user, hostnames,
                vm.selectedEventType, "Created via Web UI."
            )
                .then(function(response) {
                    vm.createInProgress = false;
                    vm.selected = [];
                    vm.createSuccessMessage = "Successfully created events.";
                    getOpenLabors();
                })
                .catch(function(error) {
                    vm.createInProgress = false;
                    vm.createErrorMessage ="Event creation failed!  " + error.statusText;
                });

        }
    }

    angular.module('hermesApp').controller('LaborStatusCtrl', LaborStatusCtrl);
    LaborStatusCtrl.$inject = [
        'HermesService',
        '$q',
        '$routeParams',
        '$location',
        '$cookies',
        'smoothScroll'
    ];
})();