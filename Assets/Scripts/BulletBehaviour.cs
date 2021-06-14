using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BulletBehaviour : MonoBehaviour
{
    public float bulletSpeed;

    private System.Random random = new System.Random();
    private Rigidbody2D bulletRb;
    private Vector3 dir;
    private float timeToSplit = 10f;
    private int subBullets = 3;

    // Start is called before the first frame update
    void Start()
    {
        bulletRb = GetComponent<Rigidbody2D>();
        transform.Rotate(0, 0, random.Next(0, 360));
        bulletRb.velocity = transform.right * bulletSpeed;
    }

    private void OnCollisionEnter2D(Collision2D collision)
    {
        Single speed = dir.magnitude;
        Vector3 direction = Vector3.Reflect(dir.normalized, collision.contacts[0].normal);
        if (bulletRb != null) bulletRb.velocity = direction * Mathf.Max(0f, speed);
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    private void FixedUpdate()
    {
        dir = bulletRb.velocity;

        timeToSplit -= Time.deltaTime;
        if (timeToSplit > 0) transform.localScale += new Vector3(Time.deltaTime, Time.deltaTime) / 30;
        else
        {
            timeToSplit = 10f;
            for (int i = 0; i < subBullets; i++)
            {
                GameObject subBullet = Instantiate(gameObject, transform.position, transform.rotation);
                subBullet.transform.Rotate(0, 0, random.Next(0, 360));
                subBullet.transform.localScale = new Vector2(0.2f, 0.2f);
            }
            Destroy(gameObject);
        }
    }
}
