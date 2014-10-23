/**
 * Created by Doron Sinai on 15/10/2014.
 */
angular.module('MyApp')
    .controller('MainCtrl', ['$scope', 'Show','$modal','$http', function($scope, Show, $modal, $http) {

        $scope.alphabet = ['0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
            'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
            'Y', 'Z'];

        $scope.genres = ['Action', 'Adventure', 'Animation', 'Children', 'Comedy',
            'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'Food',
            'Home and Garden', 'Horror', 'Mini-Series', 'Mystery', 'News', 'Reality',
            'Romance', 'Sci-Fi', 'Sport', 'Suspense', 'Talk Show', 'Thriller',
            'Travel'];

        $scope.headingTitle = 'Top 12 Shows';

        $scope.shows = Show.query();

        $scope.filterByGenre = function(genre) {
            $scope.shows = Show.query({ genre: genre });
            $scope.headingTitle = genre;
        };

        $scope.changeUrl = function(showId){
                //$modal({title: 'My Title', content: 'My Content', show: true});
                var show = Show.get({_id:showId})
                var scope = $scope.$new();
                scope.update = function(){
                    modal.hide();
                    show.url = scope.show.url;
                    $http.post('/api/shows/' + show._id, {_id:show._id, url:scope.show.url}).
                        success(function(data, status, headers, config) {

                        }).
                        error(function(data, status, headers, config) {
                        });
                }
                scope.show = show;
                var modal = $modal({
                    scope: scope,
                    template: 'views/changeUrlModal.html',
                    show: true,
                    title:"Change show URL",
                    content:"hghghghg"
                });
        }

        $scope.filterByAlphabet = function(char) {
            $scope.shows = Show.query({ alphabet: char });
            $scope.headingTitle = char;
        };
    }]);