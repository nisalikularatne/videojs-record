/**
 * @file lamejs-plugin.js
 * @since 1.1.0
 */

const RecordEngine = videojs.getComponent('RecordEngine');

/**
 * Audio-only engine for the lamejs library.
 *
 * @class
 * @augments videojs.RecordEngine
 */
class LamejsEngine extends RecordEngine {
    /**
     * Setup recording engine.
     */
    setup(stream, mediaType, debug) {
        this.inputStream = stream;
        this.mediaType = mediaType;
        this.debug = debug;
        this.audioType = 'audio/mp3';

        this.config = {
            debug: this.debug,
            sampleRate: this.sampleRate,
            bitRate: this.bitRate
        };

        this.engine = new Worker(this.audioWorkerURL);
        this.engine.onmessage = this.onWorkerMessage.bind(this);
        this.engine.postMessage({cmd: 'init', config: this.config});
    }

    /**
     * Start recording.
     */
    start() {
        let AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        this.audioSourceNode = this.audioContext.createMediaStreamSource(
            this.inputStream);
        // a bufferSize of 0 instructs the browser to choose the best bufferSize
        this.processor = this.audioContext.createScriptProcessor(
            0, 1, 1);
        this.processor.onaudioprocess = this.onAudioProcess.bind(this);
        this.audioSourceNode.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    /**
     * Stop recording.
     */
    stop() {
        if (this.processor && this.audioSourceNode) {
            this.audioSourceNode.disconnect();
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
        }
        if (this.audioContext) {
            // ignore errors about already being closed
            this.audioContext.close().then(() => {}).catch((reason) => {});
        }

        // free up memory
        this.engine.postMessage({cmd: 'finish'});
    }

    /**
     * Received a message from the worker.
     */
    onWorkerMessage(ev) {
        switch (ev.data.cmd) {
            case 'end':
                this.onStopRecording(new Blob(ev.data.buf,
                    {type: this.audioType}));
                break;

            case 'error':
                this.player().trigger('error', ev.data.error);
                break;

            default:
                // invalid message received
                this.player().trigger('error', ev.data);
                break;
        }
    }

    /**
     * Continuous encoding of audio data.
     * @private
     */
    onAudioProcess(ev) {
        // send microphone data to LAME for MP3 encoding while recording
        let data = ev.inputBuffer.getChannelData(0);

        this.engine.postMessage({cmd: 'encode', buf: data});
    }
}

// expose plugin
videojs.LamejsEngine = LamejsEngine;

export default LamejsEngine;
