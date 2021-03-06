(function() {

    'use strict';

    var app = angular.module('hermesApp',
        [
            'ngAnimate',
            'ngRoute',
            'ngLocationUpdate',
            'smoothScroll',
            'ui.bootstrap',
            'ngCookies',
        ]);

    app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
        $routeProvider.when('/v1/quests/:questId?', {
            templateUrl: '/templates/questStatus.html',
            reloadOnSearch: false
        }).when('/v1/quest/new', {
            templateUrl: '/templates/questCreation.html',
            reloadOnSearch: false
        }).when('/v1/quests/:questId/edit', {
            templateUrl: '/templates/questEdit.html',
            reloadOnSearch: false
        }).when('/v1/labors/:laborId?', {
            templateUrl: '/templates/laborList.html',
            reloadOnSearch: false
        }).when('/v1/fates', {
            templateUrl: '/templates/fateViewer.html',
            reloadOnSearch: false
        }).when('/home', {
            templateUrl: '/templates/userHome.html',
            reloadOnSearch: false
        }).otherwise({redirectTo: '/home/'});

        // use the HTML5 History API
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });
    }]);

})();