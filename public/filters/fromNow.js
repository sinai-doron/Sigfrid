/**
 * Created by Doron Sinai on 15/10/2014.
 */
angular.module('MyApp').
    filter('fromNow', function() {
        return function(date) {
            return moment(date).fromNow();
        }
    });