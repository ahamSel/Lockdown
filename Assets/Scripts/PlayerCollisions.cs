using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerCollisions : MonoBehaviour
{
    private Dictionary<string, Action> powerupsCata;
    public float shieldTime, fireTime, doubleTimeTime, halveTimeTime, shrinkTime, growTime, speedUpTime, slowDownTime;
    public bool shieldOn, fireOn;

    public int playerHealth = 10;

    private PlayerMvt playerMvt;

    private float powerupTimeLength = 10f;

    private List<float> powerupTimes;
    private Color playerColor, shieldColor, fireColor, doubleTimeColor, halveTimeColor, shrinkColor, growColor, speedUpColor, slowDownColor;

    // Start is called before the first frame update
    void Start()
    {
        playerMvt = GetComponent<PlayerMvt>();

        playerColor = GetComponent<SpriteRenderer>().color;

        powerupsCata = new Dictionary<string, Action>()
        {
            { "Health", IncreasePlayerHealth },
            { "Shield", ShieldPlayer },
            { "Timex2", DoubleTimeSpeed },
            { "Time/2", HalveTimeSpeed },
            { "Raze", RazeMostBullets },
            { "Fire", PlayerBurnsBullets },
            { "Shrink", ShrinkPlayer },
            { "Grow", GrowPlayer },
            { "SpeedUp", SpeedUpPlayer },
            { "SlowDown", SlowDownPlayer },
        };

        powerupTimes = new List<float>();

        shieldColor = GameObject.Find("Shield").GetComponent<SpriteRenderer>().color;
        fireColor = GameObject.Find("Fire").GetComponent<SpriteRenderer>().color;
        shrinkColor = GameObject.Find("Shrink").GetComponent<SpriteRenderer>().color;
        growColor = GameObject.Find("Grow").GetComponent<SpriteRenderer>().color;
        speedUpColor = GameObject.Find("SpeedUp").GetComponent<SpriteRenderer>().color;
        slowDownColor = GameObject.Find("SlowDown").GetComponent<SpriteRenderer>().color;
        doubleTimeColor = GameObject.Find("Timex2").GetComponent<SpriteRenderer>().color;
        halveTimeColor = GameObject.Find("Time/2").GetComponent<SpriteRenderer>().color;
    }

    // Update is called once per frame
    void Update()
    {
        if (playerHealth < 1) Destroy(gameObject);
    }

    private void FixedUpdate()
    {
        if (shieldTime > 0) shieldTime -= Time.unscaledDeltaTime;
        else if (shieldTime < 0) ShieldOff();

        if (fireTime > 0) fireTime -= Time.unscaledDeltaTime;
        else if (fireTime < 0) FireOff();

        if (doubleTimeTime > 0) doubleTimeTime -= Time.unscaledDeltaTime;
        else if (doubleTimeTime < 0) NormalTimeSpeed();

        if (halveTimeTime > 0) halveTimeTime -= Time.unscaledDeltaTime;
        else if (halveTimeTime < 0) NormalTimeSpeed();

        if (speedUpTime > 0) speedUpTime -= Time.unscaledDeltaTime;
        else if (speedUpTime < 0) NormalPlayerSpeed();

        if (slowDownTime > 0) slowDownTime -= Time.unscaledDeltaTime;
        else if (slowDownTime < 0) NormalPlayerSpeed();

        if (growTime > 0) growTime -= Time.unscaledDeltaTime;
        else if (growTime < 0) NormalPlayerSize();

        if (shrinkTime > 0) shrinkTime -= Time.unscaledDeltaTime;
        else if (shrinkTime < 0) NormalPlayerSize();

        ColorSwitchHandler();
    }

    private void OnCollisionEnter2D(Collision2D col)
    {
        if (col.gameObject.CompareTag("Bullet"))
        {
            if (fireOn) Destroy(col.gameObject);
            if (!fireOn && !shieldOn) playerHealth--;
        }
    }

    private void OnTriggerEnter2D(Collider2D trig)
    {
        powerupsCata[trig.name.Substring(0, trig.name.IndexOf('('))]();
        Destroy(trig.gameObject);
    }

    void IncreasePlayerHealth()
    {
        playerHealth += 5;
    }

    void ShieldPlayer()
    {
        fireOn = false; fireTime = 0;
        shieldOn = true;
        shieldTime += powerupTimeLength;
    }

    void DoubleTimeSpeed()
    {
        halveTimeTime = 0;
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 2f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        doubleTimeTime += powerupTimeLength;
    }
    void HalveTimeSpeed()
    {
        doubleTimeTime = 0;
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 0.1f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        halveTimeTime += powerupTimeLength;
    }

    void RazeMostBullets()
    {
        GameObject[] bullets = GameObject.FindGameObjectsWithTag("Bullet");
        for (int i = 3; i < bullets.Length; i++)
            Destroy(bullets[i]);
    }

    void PlayerBurnsBullets()
    {
        shieldOn = false; shieldTime = 0;
        fireOn = true;
        fireTime += powerupTimeLength;
    }

    void ShrinkPlayer()
    {
        growTime = 0;
        transform.localScale = new Vector2(0.2f, 0.2f);
        shrinkTime += powerupTimeLength;
    }
    void GrowPlayer()
    {
        shrinkTime = 0;
        transform.localScale = new Vector2(0.8f, 0.8f);
        growTime += powerupTimeLength;
    }

    void SpeedUpPlayer()
    {
        slowDownTime = 0;
        playerMvt.moveSpeed = 15f / Time.timeScale;
        speedUpTime += powerupTimeLength;
    }
    void SlowDownPlayer()
    {
        speedUpTime = 0;
        playerMvt.moveSpeed = 5f / Time.timeScale;
        slowDownTime += powerupTimeLength;
    }

    public void ShieldOff()
    {
        shieldOn = false;
        shieldTime = 0;
    }
    public void FireOff()
    {
        fireOn = false;
        fireTime = 0;
    }
    public void NormalPlayerSpeed()
    {
        playerMvt.moveSpeed = 10f / Time.timeScale;
        speedUpTime = 0;
        slowDownTime = 0;
    }
    public void NormalPlayerSize()
    {
        transform.localScale = new Vector2(0.5f, 0.5f);
        growTime = 0;
        shrinkTime = 0;
    }
    public void NormalTimeSpeed()
    {
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 1f;
        Time.fixedDeltaTime = 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        doubleTimeTime = 0;
        halveTimeTime = 0;
    }

    void ColorSwitchHandler()
    {
        powerupTimes.Clear();
        powerupTimes.Add(shieldTime);
        powerupTimes.Add(fireTime);
        powerupTimes.Add(speedUpTime);
        powerupTimes.Add(slowDownTime);
        powerupTimes.Add(growTime);
        powerupTimes.Add(shrinkTime);
        powerupTimes.Add(doubleTimeTime);
        powerupTimes.Add(halveTimeTime);

        powerupTimes.Sort();
        powerupTimes.Reverse();

        if (powerupTimes[0] > 0)
        {
            Color selectedColor = Color.black;
            if (powerupTimes[0] == shieldTime) selectedColor = shieldColor;
            if (powerupTimes[0] == halveTimeTime) selectedColor = halveTimeColor;
            if (powerupTimes[0] == slowDownTime) selectedColor = slowDownColor;
            if (powerupTimes[0] == doubleTimeTime) selectedColor = doubleTimeColor;
            if (powerupTimes[0] == speedUpTime) selectedColor = speedUpColor;
            if (powerupTimes[0] == shrinkTime) selectedColor = shrinkColor;
            if (powerupTimes[0] == fireTime) selectedColor = fireColor;
            if (powerupTimes[0] == growTime) selectedColor = growColor;
            GetComponent<SpriteRenderer>().color = selectedColor;
        }
        else GetComponent<SpriteRenderer>().color = playerColor;

        for (int i = 1; i < powerupTimes.Count - 4; i++) // 4 because 4 powerups cancel other four. otherwise i would consider them all
        {
            if (powerupTimes[i] > 0)
            {
                Color childColor = Color.black;
                if (powerupTimes[i] == shieldTime) childColor = shieldColor;
                if (powerupTimes[i] == halveTimeTime) childColor = halveTimeColor;
                if (powerupTimes[i] == slowDownTime) childColor = slowDownColor;
                if (powerupTimes[i] == doubleTimeTime) childColor = doubleTimeColor;
                if (powerupTimes[i] == speedUpTime) childColor = speedUpColor;
                if (powerupTimes[i] == shrinkTime) childColor = shrinkColor;
                if (powerupTimes[i] == fireTime) childColor = fireColor;
                if (powerupTimes[i] == growTime) childColor = growColor;
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().color = childColor;
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().sortingOrder = i;
            }
            else
            {
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().color = playerColor;
                transform.GetChild(i - 1).GetComponent<SpriteRenderer>().sortingOrder = -1;
            }
        }
    }
}
