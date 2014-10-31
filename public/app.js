/**
 * Created by Doron Sinai on 15/10/2014.
 */
angular.module('MyApp', ['ngCookies', 'ngResource', 'ngMessages', 'ngRoute', 'mgcrea.ngStrap'])
    .config(['$locationProvider', '$routeProvider', function($locationProvider, $routeProvider) {
        $locationProvider.html5Mode(true);

        $routeProvider
            .when('/', {
                templateUrl: 'views/home.tpl.html',
                controller: 'MainCtrl'
            })
            .when('/shows/:id', {
                templateUrl: 'views/detail.tpl.html',
                controller: 'DetailCtrl'
            })
            .when('/login', {
                templateUrl: 'views/login.html',
                controller: 'LoginCtrl'
            })
            .when('/signup', {
                templateUrl: 'views/signup.html',
                controller: 'SignupCtrl'
            })
            .when('/add', {
                templateUrl: 'views/add.tpl.html',
                controller: 'AddCtrl'
            })
            .when('/calendar',{
                templateUrl: 'views/calendar.tpl.html',
                controller: 'CalendarCtrl'
            })
            .when('/calendar/:year/:month',{
                templateUrl: 'views/calendar.tpl.html',
                controller: 'CalendarCtrl'
            })
            .otherwise({
                redirectTo: '/'
            });


    }]);