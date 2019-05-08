import assert from "assert";
import {batchOptions, consumerConfig, producerConfig, topic} from "../config";
import {NConsumer, NProducer} from "../../src";

describe("Native Client INT", () => {

  let consumer = null;
  let producer = null;
  const consumedMessages = [];
  let firstMessageReceived = false;
  let messagesChecker;
  let offsets = [];

  before(done => {

    producer = new NProducer(producerConfig as any, null, 1);
    consumer = new NConsumer([topic], consumerConfig as any);

    producer.on("error", error => console.error(error));
    consumer.on("error", error => console.error(error));

    Promise.all([
      producer.connect(),
      consumer.connect(),
    ]).then(() => {

      consumer.consume((messages, callback) => {

        messages.forEach((message) => {
          consumedMessages.push(message);
          if(!firstMessageReceived){
            firstMessageReceived = true;
          }
        });

        callback();
      }, true, false, batchOptions);

      setTimeout(done, 100);
    });
  });

  after(done => {
    if(producer && consumer){
      producer.close();
      consumer.close(true); //commit
      setTimeout(done, 100);
    }
  });

  it("should be able to produce messages", () => {

    const promises = [
      producer.send(topic, "a message"),
      producer.bufferFormatPublish(topic, "1", {content: "a message 1"}, 1, null, 0),
      producer.bufferFormatUpdate(topic, "2", {content: "a message 2"}, 1, null, 0),
      producer.bufferFormatUnpublish(topic, "3", {content: "a message 3"}, 1, null, 0),
      producer.send(topic, Buffer.from("a message buffer")),
    ];

    return Promise.all(promises).then((produceResults) => {
      produceResults.forEach((produceResult) => {
        if(produceResult.offset !== null) {
          offsets.push(produceResult.offset);
        }
      });
      assert.ok(offsets.length > 0);
    });
  });

  it("should be able to wait", done => {
    messagesChecker = setInterval(()=>{
      if(consumedMessages.length >= 5){
        clearInterval(messagesChecker);
        done();
      }
    }, 100);
  });

  it("should have received first message", done => {
    assert.ok(firstMessageReceived);
    producer.getTopicList().then((topics) => {
      assert.ok(topics.length);
      done();
    });
  });

  it("should be able to consume messages", done => {
    // console.log(consumedMessages);
    assert.ok(consumedMessages.length >= 5);
    assert.ok(!Buffer.isBuffer(consumedMessages[0].value));
    assert.ok(consumedMessages[1].key, "1");
    assert.ok(consumedMessages[2].key, "2");
    assert.ok(consumedMessages[3].key, "3");
    assert.equal(consumedMessages[0].value, "a message");
    assert.equal(JSON.parse(consumedMessages[1].value).payload.content, "a message 1");
    assert.equal(JSON.parse(consumedMessages[2].value).payload.content, "a message 2");
    assert.equal(JSON.parse(consumedMessages[3].value).payload.content, "a message 3");
    assert.equal(consumedMessages[4].value, "a message buffer");
    done();
  });

  it("should see produced offset in consumed messages", done => {
    const anOffset = offsets[0];
    let seen = false;
    consumedMessages.forEach((message) => {
      if(message.offset === anOffset){
        seen = true;
      }
    });
    assert.ok(seen);
    done();
  });
});
