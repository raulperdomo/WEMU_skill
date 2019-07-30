// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const request = require('request');
const Adapter = require('ask-sdk-dynamodb-persistence-adapter');

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
                        for(counter = 0; counter < 5; counter++) {
                            shows.push(result['rss']['channel'][0]['item'][counter]['enclosure'][0]['ATTR']['url']);
                            console.log('Link: ' + util.inspect(result['rss']['channel'][0]['item'][counter]['enclosure'][0]['ATTR']['url']));
                           /* console.log('Shows: ' + shows);
                            console.log('Title: ' + util.inspect(result['rss']['channel'][0]['item'][counter]['title'][0]));//, false, null))
                            console.log('Link: ' + util.inspect(result['rss']['channel'][0]['item'][counter]['link'][0]));
                            */
                        }
                        console.log('In Shows: ' + shows);
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

        const dynamoDbPersistenceAdapter = new Adapter({ tableName : 'PlaybackTable', createTable : 'true' });
        dynamoDbPersistenceAdapter.saveAttributes(handlerInput.requestEnvelope,
            attributes : { 'test' : 1234});
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
        const dynamoDbPersistenceAdapter = new Adapter({ tableName : 'PlaybackTable', createTable : 'true' });
        let attributes = await dynamoDbPersistenceAdapter.getAttributes(handlerInput.requestEnvelope);
        //return handlerInput.responseBuilder
          //  .speak(speechText)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            //.getResponse();
        console.log('Playing News Cast.')
        return handlerInput.responseBuilder.speak(speechText)
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
        const speechText = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
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
const PauseIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent');
    },
    handle(handlerInput) {
        const speechText = 'Thanks for listening!';
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
        let shows = await getEpisodes();
        console.log('Handler Activated: AudioPlayer.PlaybackNearlyFinished');
        console.log(handlerInput.requestEnvelope.context.AudioPlayer.token);
        console.log(shows);
        let lastToken = parseInt(handlerInput.requestEnvelope.context.AudioPlayer.token);
        let token = lastToken + 1;
        console.log('Token: ' + token + '\nlastToken: ' + lastToken + '\nShow URL: ' + shows[token]);
        /*console.log(sessionAttributes.shows);
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var token = parseInt(this.context.AudioPlayer.token, 10) + 1;
        var last = token - 1;
        console.log("token: " + token);
        console.log('Enqueuing: ' + sessionAttributes.shows[token]);
*/
        const speechText = 'Playing Next Podcast!';
        return handlerInput.responseBuilder
            //.addAudioPlayerPlayDirective("ENQUEUE", 'https://cpa.ds.npr.org/wemu/audio/2019/07/WashUnited071519.mp3', 'string',0, 'string')
            .addAudioPlayerPlayDirective("ENQUEUE", shows[token], token.toString(),0 , lastToken.toString())
            .getResponse();
        
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
        NewsIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler) // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    .addErrorHandlers(
        ErrorHandler)
    .withPersistenceAdapter(Adapter)
    .lambda();


