/**
 * Created by Doron Sinai on 16/10/2014.
 */
angular.module('MyApp')
    .factory('Episode', ['$resource', function($resource) {
        return $resource('/api/episodes/:_id');
    }]);