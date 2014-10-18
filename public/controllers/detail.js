/**
 * Created by Doron Sinai on 15/10/2014.
 */
angular.module('MyApp')
    .controller('DetailCtrl', ['$scope', '$rootScope', '$routeParams', 'Show', 'Subscription','Episode','$http','Colors',
        function($scope, $rootScope, $routeParams, Show, Subscription, Episode, $http, Colors) {
            Show.get({ _id: $routeParams.id }, function(show) {
                $scope.maxSeason = 0;
                $scope.minSeason = 1;
                for(var i=0; i < show.episodes.length; i++ ){
                    var season = show.episodes[i].season;
                    show.episodes[i].color = Colors[show.episodes[i].season];
                    if(season > $scope.maxSeason){
                        $scope.maxSeason = season;
                    }
                    if( season < $scope.minSeason){
                        $scope.minSeason = season;
                    }
                }
                $scope.seasonsRange = (function(){
                    var array = [];
                    for(var index=$scope.minSeason; index<=$scope.maxSeason; index++){
                        array.push(index);
                    }
                    return array;
                })();

                $scope.show = show;

                $scope.isSubscribed = function() {
                    return $scope.show.subscribers.indexOf($rootScope.currentUser._id) !== -1;
                };

                $scope.subscribe = function() {
                    Subscription.subscribe(show).success(function() {
                        $scope.show.subscribers.push($rootScope.currentUser._id);
                    });
                };

                $scope.unsubscribe = function() {
                    Subscription.unsubscribe(show).success(function() {
                        var index = $scope.show.subscribers.indexOf($rootScope.currentUser._id);
                        $scope.show.subscribers.splice(index, 1);
                    });
                };

                $scope.updateEpisode = function(id, watched,episode){
                    debugger;
                    $http.put('/api/episodes/' + id, {_id:id, watched:watched}).
                        success(function(data, status, headers, config) {

                        }).
                        error(function(data, status, headers, config) {
                            episode.watched = !episode.watched;
                        });
                }

                $scope.nextEpisode = show.episodes.filter(function(episode) {
                    return new Date(episode.firstAired) > new Date();
                })[0];

                $scope.all = false;

                $scope.changeSeason = function(season){
                    $scope.all = season;
                }


            });
        }]);