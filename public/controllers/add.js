/**
 * Created by Doron Sinai on 15/10/2014.
 */
angular.module('MyApp')
    .controller('AddCtrl', ['$scope', '$alert', 'Show','$modal', function($scope, $alert, Show, $modal) {
        $scope.addShow = function() {
            Show.save({ showName: $scope.showName },
                function() {
                    $scope.showName = '';
                    $scope.addForm.$setPristine();
                    $alert({
                        content: 'TV show has been added.',
                        placement: 'top-right',
                        type: 'success',
                        duration: 3
                    });
                },
                function(response) {
                    $scope.showName = '';
                    $scope.addForm.$setPristine();
                    if(response.status === 430){
                        //$modal({title: 'My Title', content: 'My Content', show: true});
                        var scope = $scope.$new();
                        scope.chooseShow = function(series){
                            modal.hide();
                            Show.save({ showName: $scope.showName, seriesId: series.seriesid },
                                function(){
                                    $scope.showName = '';
                                    $scope.addForm.$setPristine();
                                    $alert({
                                        content: 'TV show has been added.',
                                        placement: 'top-right',
                                        type: 'success',
                                        duration: 3
                                    });
                                },function(response){
                                    $scope.showName = '';
                                    $scope.addForm.$setPristine();
                                    $alert({
                                        content: response.data.message,
                                        placement: 'top-right',
                                        type: 'danger',
                                        duration: 3
                                    });
                                });
                        }
                        scope.series =response.data.data
                        var modal = $modal({
                            scope: scope,
                            template: 'views/toomany.tpl.html',
                            show: true,
                            title:response.data.message,
                            content:"hghghghg"
                        });
                    }
                    else{
                        $alert({
                            content: response.data.message,
                            placement: 'top-right',
                            type: 'danger',
                            duration: 3
                        });
                    }
                });
        };
    }]);