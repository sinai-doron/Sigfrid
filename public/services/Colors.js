/**
 * Created by Doron Sinai on 18/10/2014.
 */
angular.module('MyApp')
    .factory('Colors', ['$http', function($http) {
        return ['#7F488C','#D47D6A','#4D9A6A','#802815','#4B5300','#496C89','#805315','#553100','#28616C','#011C21'];
    }]);