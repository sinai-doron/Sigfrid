/**
 * Created by Doron Sinai on 15/10/2014.
 */
'use strict';

/**
 * Grunt Module
 */
module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-contrib-sass');

    grunt.registerTask('default', ['sass']);
    /**
     * Configuration
     */
    grunt.initConfig({
        /**
         * Get package meta data
         */
        pkg: grunt.file.readJSON('package.json'),
        /**
         * Sass
         */
        sass: {
            dev: {
                options: {
                    style: 'expanded',
                    //banner: '<%= tag.banner %>',
                    compass: false,
                    lineNumbers:true
                },
                files: {                         // Dictionary of files
                    'public/stylesheets/style.css': 'public/stylesheets/style.scss'
                    //'widgets.css': 'widgets.scss'
                }
            }/*,
            dist: {
                options: {
                    style: 'compressed',
                    compass: true
                },
                files: {
                    '<%= project.assets %>/css/style.css': '<%= project.css %>'
                }
            }*/
        }
    });
};