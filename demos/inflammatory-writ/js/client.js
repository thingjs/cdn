$(function(){

    agent(
        '@host test.thingjs.org',
        '@port 8080',
        'abstract test.thingjs.org extends Mqtt'
    );
            
    agent('extends test.thingjs.org', {

        setup: function(cb) {
            this.$super(cb);

            this.addBehaviour(
                'inflammatory-writ extends Sensor',
                '@limit 10', 
                '@flow onText', {

                    onText: function(text, $cb) {
                        $('#typed').typed({
                            strings: [text.toString()],
                            typeSpeed: 120,
                            backDelay: 500,
                            loop: false,
                            loopCount: false,
                            callback: function() {
                                $('#typed').typed('reset');
                                $cb();
                            }       
                        }); 
                    }

                }
            );
        }

    });

});