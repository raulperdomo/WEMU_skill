// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const request = require('request');
const { DynamoDbPersistenceAdapter }  = require('ask-sdk-dynamodb-persistence-adapter');
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ tableName: 'PlaybackTable', createTable: true });

//function hello()
//{
//    console.log('Functions are fun!')
//}
function getEpisodes() {
    const https = require('https');
    const xml2js = require('xml2js');
    const util = require('util')
    const parser = new xml2js.Parser({ attrkey: "ATTR" });
    return new Promise (function(resolve, reject) {
        let req = https.get("https://www.wemu.org/podcasts", function(res) {
            let data = '';
            res.on('data', function(stream) {
                data += stream;
            });
        
            res.on('end', function(){
                parser.parseString(data, function(error, result) {
                    if(error === null) {
        
                        var counter;
                        var shows = [];
                        for(counter = 0; counter < 10; counter++) {
                            
                            var title = result['rss']['channel'][0]['item'][counter]['title'][0];
                            var author = result['rss']['channel'][0]['item'][counter]['description'][0];
                            var url = result['rss']['channel'][0]['item'][counter]['enclosure'][0]['ATTR']['url'];
                            shows.push([title,author,url]);

                        }
                        //console.log('In Shows: ' + shows);
                        resolve(shows);
                    }
                    else {
                        console.log(error);
                    }
                });
            });
        });
    });
}
function getEmailAddress(apiKey, apiEndpoint)
{
    var email = '';
    var name = '';
    var emailResponse = 0;
    var nameResponse = 0;
    return new Promise (function(resolve, reject) {
        
        //This first request retrieves the email address of the user if that info is available to us.
        request.get(apiEndpoint + '/v2/accounts/~current/settings/Profile.email').auth(null, null, true, apiKey)
        .on('response', function(response) {
            emailResponse = response.statusCode;
        })
        .on('data', function(chunk) {
            email += chunk;
        })
        .on('end', function() {
            if (emailResponse == 200) {
                
                //This second block does the same thing but hist the endpoint to pull the user's Full Name. 
                request.get(apiEndpoint + '/v2/accounts/~current/settings/Profile.name').auth(null, null, true, apiKey)
                .on('response', function(response) {
                    nameResponse = response.statusCode;
                })
                .on('data', function(chunk) {
                    name += chunk;
                })
                .on('end', function() {
                    if(nameResponse == 200) {
                        resolve({name,email});
                    } else {
                        reject('Full Name Permission Not Given.');
                    }
                });
            } else {
                reject('Email Permission Not Given.');
            }
        });
    })
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {

        const apiKey = handlerInput.requestEnvelope.context.System.apiAccessToken;
        const apiEndpoint = handlerInput.requestEnvelope.context.System.apiEndpoint;
        //console.log('API Key and Endpoint ', apiKey, apiEndpoint)
        try {
            /* userInfo is a JS object with two values userInfo.name and userInfo.email
            this will only be populated if they have given us permission to use that info. */
            var userInfo = await getEmailAddress(apiKey, apiEndpoint);
            console.log('User Data: \n\tName: ' +  userInfo.name + '\n\tEmail: ' + userInfo.email);
        }
        catch(error) {
            console.error('Api Auth Error: ' + error);
        }
        const speechText = 'Welcome to W E M U. You can ask to hear the radio or the news. What would you like to hear?';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};


const ListenLiveIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'ListenLiveIntent';
    },
    handle(handlerInput) {
        console.log('Opening Radio Stream.')
        return handlerInput.responseBuilder.speak('Ok, playing 89 point 1 W E M U FM')
        .withStandardCard('89.1 WEMU FM', 'Your Community NPR Station','https://wemu.s3.amazonaws.com/WEMU.jpg')
        .addAudioPlayerPlayDirective("REPLACE_ALL", 'https://18093.live.streamtheworld.com/WEMUFM.mp3', 'string',0)
        .getResponse();
          
        
    }
};
const NewsIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'NewsIntent';
    },
    async handle(handlerInput) {
        const speechText = 'Here is the latest news from W E M U.';
        
        //let attributes = handlerInput.attributesManager.getPersistentAttributes();
        //console.log(attributes);
        
        console.log('Playing News Cast.')
        return handlerInput.responseBuilder.speak(speechText)
            .withStandardCard('WEMU Latest News', 'Your Community NPR Station.\nwemu.org','https://wemu.s3.amazonaws.com/WEMU.jpg')
            .addAudioPlayerPlayDirective("REPLACE_ALL", 'https://perdomo.org/newscast.mp4', '-1',0)
            .getResponse();
          
        
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = 'You can ask to hear the live radio stream, or the latest news.';
        
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};

const StartOverIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StartOverIntent';
    },
    async handle(handlerInput) {
        var requestToken = handlerInput.requestEnvelope.context.AudioPlayer.token;
        if (requestToken === 'string') {
            return handlerInput.responseBuilder
                .speak('You cannot start over when listening to the live stream.')
                .getResponse()
        } else {
            lastToken = parseInt(requestToken);

            const shows = await getEpisodes();
            console.log('lastToken: ' + lastToken + '\nShow Info: ' + shows[lastToken]);

            return handlerInput.responseBuilder
                .withSimpleCard(shows[lastToken][0],shows[lastToken][1])
                .addAudioPlayerPlayDirective("REPLACE_ALL", shows[lastToken][2], lastToken.toString(),0)
                .getResponse();
        }

        
    }
};

const ShuffleIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ShuffleOnIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ShuffleOffIntent');
    },
    handle(handlerInput) {
        const speechText = 'This skill does not support shuffling playback.';
        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const LoopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOnIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOffIntent');
    },
    handle(handlerInput) {
        const speechText = 'This skill does not support looping playback.';
        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = 'Thanks for listening!';
        return handlerInput.responseBuilder.addAudioPlayerStopDirective()
            .speak(speechText)
            .getResponse();
    }
};

const NextIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent');
    },
    async handle(handlerInput) {

        console.log('Next podcast requested.');
        //console.log(handlerInput.requestEnvelope.context.AudioPlayer);
        var requestToken = handlerInput.requestEnvelope.context.AudioPlayer.token;
        if (requestToken === 'string') {
            return handlerInput.responseBuilder
                .speak('You cannot skip when listening to the live stream.')
                .getResponse()
        } else {
            lastToken = parseInt(requestToken);
            let token = lastToken + 1;

            const shows = await getEpisodes();
            console.log('Token: ' + token + '\nlastToken: ' + lastToken + '\nShow Info: ' + shows[token]);

            return handlerInput.responseBuilder
                .withSimpleCard(shows[token][0],shows[token][1])
                .addAudioPlayerPlayDirective("REPLACE_ALL", shows[token][2], token.toString(),0)
                .getResponse();
        }
    }
};

const PreviousIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent');
    },
    async handle(handlerInput) {

        console.log('Previous podcast requested.');
        //console.log(handlerInput.requestEnvelope.context.AudioPlayer);
        var requestToken = handlerInput.requestEnvelope.context.AudioPlayer.token;
        if (requestToken === 'string') {
            return handlerInput.responseBuilder
                .speak('You cannot skip when listening to the live stream.')
                .getResponse()
        } else {
            lastToken = parseInt(requestToken);
            let token = lastToken - 1;
            if (token < 0) {
                return handlerInput.responseBuilder
                    .withStandardCard('WEMU Latest News', 'Your Community NPR Station.\nwemu.org','https://wemu.s3.amazonaws.com/WEMU.jpg')
                    .addAudioPlayerPlayDirective("REPLACE_ALL", 'https://perdomo.org/newscast.mp4', '-1',0)
                    .getResponse();
            }
            const shows = await getEpisodes();
            console.log('Token: ' + token + '\nlastToken: ' + lastToken + '\nShow Info: ' + shows[token]);

            return handlerInput.responseBuilder
                .withSimpleCard(shows[token][0],shows[token][1])
                .addAudioPlayerPlayDirective("REPLACE_ALL", shows[token][2], token.toString(),0)
                .getResponse();
        }
    }
};

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent');
    },
    async handle(handlerInput) {

        console.log('Repeat podcast requested.');
        //console.log(handlerInput.requestEnvelope.context.AudioPlayer);
        var requestToken = handlerInput.requestEnvelope.context.AudioPlayer.token;
        if (requestToken === 'string') {
            return handlerInput.responseBuilder
                .speak('You cannot enable repeat when listening to the live stream.')
                .getResponse()
        } else {
            
            if (requestToken === '-1') {
                return handlerInput.responseBuilder
                    .addAudioPlayerPlayDirective("ENQUEUE", 'https://perdomo.org/newscast.mp4', '-1',0, '-1')
                    .getResponse();
            }
            lastToken = parseInt(requestToken);
            const shows = await getEpisodes();
            console.log('\nlastToken: ' + lastToken + '\nShow Info: ' + shows[token]);

            return handlerInput.responseBuilder
                .withSimpleCard(shows[lastToken][0],shows[lastToken][1])
                .addAudioPlayerPlayDirective("ENQUEUE", shows[lastToken][2], lastToken.toString(),0,lastToken.toString() )
                .getResponse();
        }
    }
};


const ResumeIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ResumeIntent');   
        
    },
    async handle(handlerInput) {
        const speechText = 'Resuming Playback.';
        var attributes = {};
        try {
            attributes = await handlerInput.attributesManager.getPersistentAttributes();
            //const attributes = await dynamoDbPersistenceAdapter.getAttributes(handlerInput.requestEnvelope);
            console.log("Attributes: \nToken: " + attributes.token,"\nOffset: ",attributes.offset);
        } catch(err) {
            console.log(err);
        }
        if (attributes.token === 'string') {

            return handlerInput.responseBuilder.speak('Ok, playing 89 point 1 W E M U FM')
                .withStandardCard('89.1 WEMU FM', 'Your Community NPR Station','https://wemu.s3.amazonaws.com/WEMU.jpg')
                .addAudioPlayerPlayDirective("REPLACE_ALL", 'https://18093.live.streamtheworld.com/WEMUFM.mp3', 'string',0)
                .getResponse();
        }
        if (attributes.token === '-1') {
            return handlerInput.responseBuilder
                .withStandardCard('WEMU Latest News', 'Your Community NPR Station.\nwemu.org','https://wemu.s3.amazonaws.com/WEMU.jpg')
                .addAudioPlayerPlayDirective("REPLACE_ALL", 'https://perdomo.org/newscast.mp4', '-1',attributes.offset)
                .getResponse();
        } 
        const shows = await getEpisodes();

        return handlerInput.responseBuilder
        .withSimpleCard(shows[attributes.token][0],shows[attributes.token][1])
        .addAudioPlayerPlayDirective("REPLACE_ALL", shows[attributes.token][2], attributes.token,attributes.offset)
            .speak(speechText)
            .getResponse();
    }
};

const PauseIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent');
    },
    async handle(handlerInput) {
        const speechText = 'Thanks for listening!';
        var currentOffset = handlerInput.requestEnvelope.context.AudioPlayer.offsetInMilliseconds;
        var currentToken = handlerInput.requestEnvelope.context.AudioPlayer.token;
        //console.log(handlerInput.requestEnvelope.context.AudioPlayer)
        console.log('Current Offset: ' + currentOffset);
        console.log('Current Token: ' + currentToken);
        const attributes = handlerInput.attributesManager.getSessionAttributes() || {};
        //const attributes = {};
        console.log(attributes);
        attributes.token = currentToken;
        attributes.offset = currentOffset;
        console.log(attributes);
        try {

           handlerInput.attributesManager.setPersistentAttributes(attributes);
           await handlerInput.attributesManager.savePersistentAttributes();
           // dynamoDbPersistenceAdapter.saveAttributes(handlerInput.requestEnvelope, attributes);

        }
        catch(error) {
            console.log(error);
        }
        return handlerInput.responseBuilder.addAudioPlayerStopDirective()
            .speak(speechText)
            .getResponse();
    }
};

const PlaybackHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackNearlyFinished';
    },
    async handle(handlerInput) {
        console.log('Handler Activated: AudioPlayer.PlaybackNearlyFinished');
        const shows = await getEpisodes();
        
        //console.log(handlerInput.requestEnvelope.context.AudioPlayer.token);
        //console.log(shows);
        let lastToken = parseInt(handlerInput.requestEnvelope.context.AudioPlayer.token);
        let token = lastToken + 1;
        console.log('\nToken: ' + token + '\nlastToken: ' + lastToken + '\nShow Info: ' + shows[token]);
        

        return handlerInput.responseBuilder
            //.addAudioPlayerPlayDirective("ENQUEUE", 'https://cpa.ds.npr.org/wemu/audio/2019/07/WashUnited071519.mp3', 'string',0, 'string')
            .withSimpleCard(shows[token][0],shows[token][1])
            .addAudioPlayerPlayDirective("ENQUEUE", shows[token][2], token.toString(),0 , lastToken.toString())
            .getResponse();
        
    }
};

const PlaybackStartedHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackStarted';
    },
    handle(handlerInput) {
    
        console.log('Playback Started!');
        return handlerInput.responseBuilder.getResponse();
        
    }
};
const PlaybackStoppedHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackStopped';
    },
    handle(handlerInput) {
    
        console.log('Playback Stopped!');
        return handlerInput.responseBuilder.getResponse();
        
    }
};
const PlaybackFinishedHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackFinished';
    },
    handle(handlerInput) {
    
        console.log('Playback Finished!');
        return handlerInput.responseBuilder.getResponse();
        
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = handlerInput.requestEnvelope.request.intent.name;
        const speechText = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speechText)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.message}`);
        console.log('Type: ', handlerInput.requestEnvelope.request.type);
        console.log(error);
        const speechText = `Sorry, I couldn't understand what you said. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};

// This handler acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ListenLiveIntentHandler,
        PauseIntentHandler,
        PlaybackHandler,
        PlaybackStartedHandler,
        PlaybackStoppedHandler,
        PlaybackFinishedHandler,
        NewsIntentHandler,
        NextIntentHandler,
        RepeatIntentHandler,
        LoopIntentHandler,
        PreviousIntentHandler,
        HelpIntentHandler,
        ShuffleIntentHandler,
        StartOverIntentHandler,
        CancelAndStopIntentHandler,
        ResumeIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler) // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    .addErrorHandlers(
        ErrorHandler)
    .withPersistenceAdapter(dynamoDbPersistenceAdapter)
    .lambda();



