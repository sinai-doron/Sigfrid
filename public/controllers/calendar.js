/**
 * Created by doron on 10/30/14.
 */
angular.module('MyApp')
    .controller('CalendarCtrl', ['$scope', '$rootScope', '$routeParams', 'Show', 'Subscription','Episode','$http','Colors','$sce',
        function($scope, $rootScope, $routeParams, Show, Subscription, Episode, $http, Colors, $sce) {
            var month = $routeParams.month - 1;
            var year = $routeParams.year;
            if((month === undefined) || !year){
                month = moment().month();
                year = moment().year();
            }
            $scope.prevMonth = moment([year,month,1]).subtract(1, 'month');
            $scope.nextMonth = moment([year,month,1]).add(1, 'month');
            $scope.month = moment([year,month,1]);
            $scope.calendar = [];

            $http.get('/api/shows/date/' + year + '/' + (month+1) + '/' , {}).
                success(function(data, status, headers, config) {
                        var days = [];
                        for(var i=0; i < 35; i++){
                            days[i] = null;
                        }

                        var incerDay = moment([year,month,1]);
                        i = incerDay.day();
                        while(incerDay.month() === $scope.month.month()){
                            days[i] = {date: incerDay.format('D/MM'), episodes:"", today:false};
                            if((incerDay.date() === moment().date()) && (incerDay.year() === moment().year()) && (incerDay.month() === moment().month())){
                                days[i]["today"] = true;
                            }
                            for(var index = 0; index < data.length; index++){
                                if(moment(data[index].firstAired).date() === incerDay.date()){
                                    if(data[index].showName == undefined){
                                        continue;
                                    }
                                    days[i].episodes += '<p>' + data[index].showName + ' ' + data[index].season + 'x' + data[index].episodeNumber + '</p>';
                                }
                            }
                            incerDay.add(1,'day');
                            days[i].episodes = $sce.trustAsHtml(days[i].episodes);
                            i++;
                        }

                        var begin = 0;
                        var end = 7;
                        for(var ii=0; ii<5; ii++){
                            $scope.calendar[ii] = days.slice(begin,end);
                            begin +=7;
                            end += 7;
                        }
                        //make sure we don't have a null array
                        var deleteLast = true;
                        for(var ii=0; ii<7; ii++){
                            if($scope.calendar[4][ii] !== null){
                                deleteLast = false;
                                break;
                            }
                        }
                        if(deleteLast === true){
                            delete $scope.calendar[4];
                        }
                }).
                error(function(data, status, headers, config) {
                });


        }]);