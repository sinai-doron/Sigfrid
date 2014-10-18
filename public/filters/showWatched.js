/**
 * Created by Doron Sinai on 17/10/2014.
 */
angular.module('MyApp').
    filter('showWatched', function() {
        return function(items,all) {
            if(!items){
                return;
            }
            var filtered = [];
            if(all === true){
                return items;
            }
            else if(all === false){
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    if (item.watched === false) {
                        filtered.push(item);
                    }
                }
            }
            else {
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    if (item.season === all) {
                        filtered.push(item);
                    }
                }
            }

            return filtered;
        }
    });